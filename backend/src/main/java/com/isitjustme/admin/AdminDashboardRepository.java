package com.isitjustme.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.isitjustme.admin.AdminDashboard.CategoryRow;
import com.isitjustme.admin.AdminDashboard.Change;
import com.isitjustme.admin.AdminDashboard.Day;
import com.isitjustme.admin.AdminDashboard.Demographic;
import com.isitjustme.admin.AdminDashboard.FunnelStep;
import com.isitjustme.admin.AdminDashboard.QuestionRow;
import com.isitjustme.admin.AdminDashboard.Totals;

import lombok.RequiredArgsConstructor;

/**
 * Reads the dashboard straight from the tables, uncached: it is opened rarely and should
 * show what is there now. Each table is scanned once per number and the days are put
 * together here, so a longer period costs no extra scans.
 */
@Repository
@RequiredArgsConstructor
public class AdminDashboardRepository {

	/** Days start and end on this clock, the one the guests live on. */
	static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

	private static final String DAY = "(%s AT TIME ZONE 'Asia/Seoul')::date";

	private final JdbcClient jdbcClient;

	@Transactional(readOnly = true)
	public AdminDashboard dashboard(int days, LocalDate today) {
		LocalDate from = today.minusDays(days - 1L);
		LocalDate previousFrom = from.minusDays(days);
		OffsetDateTime since = from.atStartOfDay(ZONE).toOffsetDateTime();
		OffsetDateTime previousSince = previousFrom.atStartOfDay(ZONE).toOffsetDateTime();

		// both periods in one scan per table; split by day below
		Map<LocalDate, Long> guests = byDay("guest", "created_at", previousSince);
		Map<LocalDate, Long> answers = byDay("category_answer", "completed_at", previousSince);
		Map<LocalDate, Long> rooms = byDay("share_room", "created_at", previousSince);
		Map<LocalDate, Long> planets = byDay("universe_planet", "joined_at", previousSince);
		Map<LocalDate, Long> finished = finishedByDay(previousSince);
		Map<LocalDate, Map<String, Long>> events = eventsByDay(previousSince);

		List<Day> daily = new ArrayList<>();
		for (LocalDate date = from; !date.isAfter(today); date = date.plusDays(1)) {
			daily.add(new Day(date, guests.getOrDefault(date, 0L), answers.getOrDefault(date, 0L),
					finished.getOrDefault(date, 0L), rooms.getOrDefault(date, 0L), planets.getOrDefault(date, 0L),
					events.getOrDefault(date, Map.of())));
		}

		Map<String, Change> period = new LinkedHashMap<>();
		period.put("guests", change(guests, from));
		period.put("answers", change(answers, from));
		period.put("finished", change(finished, from));
		period.put("rooms", change(rooms, from));
		period.put("planets", change(planets, from));
		Map<String, Map<LocalDate, Long>> byType = new TreeMap<>();
		events.forEach((date, counts) -> counts
			.forEach((type, count) -> byType.computeIfAbsent(type, (t) -> new HashMap<>()).put(date, count)));
		byType.forEach((type, counts) -> period.put(type, change(counts, from)));

		Totals totals = totals();
		List<Long> progress = progress(totals.guests());
		return new AdminDashboard(Instant.now(), days, totals, period, daily, funnel(totals, progress), progress,
				categories(), demographics(), hours(since), questions());
	}

	private static Change change(Map<LocalDate, Long> counts, LocalDate from) {
		long current = 0;
		long previous = 0;
		for (Map.Entry<LocalDate, Long> entry : counts.entrySet()) {
			if (entry.getKey().isBefore(from)) {
				previous += entry.getValue();
			}
			else {
				current += entry.getValue();
			}
		}
		return new Change(current, previous);
	}

	// table and column are constants from this class, never input
	private Map<LocalDate, Long> byDay(String table, String column, OffsetDateTime since) {
		Map<LocalDate, Long> counts = new HashMap<>();
		jdbcClient.sql("SELECT %s AS day, COUNT(*) FROM %s WHERE %s >= :since GROUP BY day"
			.formatted(DAY.formatted(column), table, column))
			.param("since", since)
			.query((rs) -> {
				counts.put(rs.getObject(1, LocalDate.class), rs.getLong(2));
			});
		return counts;
	}

	/** A guest finishes on the day their last category was completed. */
	private Map<LocalDate, Long> finishedByDay(OffsetDateTime since) {
		Map<LocalDate, Long> counts = new HashMap<>();
		jdbcClient.sql("""
				SELECT %s AS day, COUNT(*)
				FROM (SELECT MAX(completed_at) AS done_at
				      FROM category_answer
				      GROUP BY guest_id
				      HAVING COUNT(*) = (SELECT COUNT(*) FROM category)) f
				WHERE done_at >= :since
				GROUP BY day
				""".formatted(DAY.formatted("done_at")))
			.param("since", since)
			.query((rs) -> {
				counts.put(rs.getObject(1, LocalDate.class), rs.getLong(2));
			});
		return counts;
	}

	private Map<LocalDate, Map<String, Long>> eventsByDay(OffsetDateTime since) {
		Map<LocalDate, Map<String, Long>> counts = new HashMap<>();
		jdbcClient.sql("SELECT %s AS day, type, COUNT(*) FROM event WHERE created_at >= :since GROUP BY day, type"
			.formatted(DAY.formatted("created_at")))
			.param("since", since)
			.query((rs) -> {
				counts.computeIfAbsent(rs.getObject(1, LocalDate.class), (day) -> new TreeMap<>())
					.put(rs.getString(2), rs.getLong(3));
			});
		return counts;
	}

	private Totals totals() {
		return jdbcClient.sql("""
				SELECT (SELECT COUNT(*) FROM guest),
				       (SELECT COUNT(*) FROM guest WHERE gender IS NOT NULL AND age_group IS NOT NULL),
				       (SELECT COUNT(DISTINCT guest_id) FROM category_answer),
				       (SELECT COUNT(*) FROM overall_answer),
				       (SELECT COUNT(*) FROM category_answer),
				       (SELECT COUNT(*) FROM share_room),
				       (SELECT COUNT(*) FROM universe_planet),
				       (SELECT COUNT(DISTINCT room_id) FROM universe_planet)
				""")
			.query((rs, i) -> new Totals(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5),
					rs.getLong(6), rs.getLong(7), rs.getLong(8)))
			.single();
	}

	/** Guests by how many categories they finished; index 0 is everyone who finished none. */
	private List<Long> progress(long guests) {
		int categories = jdbcClient.sql("SELECT COUNT(*) FROM category").query(Integer.class).single();
		long[] counts = new long[categories + 1];
		jdbcClient.sql("""
				SELECT n, COUNT(*) FROM (SELECT COUNT(*) AS n FROM category_answer GROUP BY guest_id) g GROUP BY n
				""").query((rs) -> {
			counts[rs.getInt(1)] = rs.getLong(2);
		});
		long some = 0;
		for (int n = 1; n < counts.length; n++) {
			some += counts[n];
		}
		counts[0] = Math.max(0, guests - some);
		List<Long> progress = new ArrayList<>();
		for (long count : counts) {
			progress.add(count);
		}
		return progress;
	}

	private static List<FunnelStep> funnel(Totals totals, List<Long> progress) {
		long half = 0;
		// half of the categories or more
		for (int n = progress.size() / 2; n < progress.size(); n++) {
			half += progress.get(n);
		}
		return List.of(new FunnelStep("visited", totals.guests()), new FunnelStep("profiled", totals.profiled()),
				new FunnelStep("started", totals.started()), new FunnelStep("halfway", half),
				new FunnelStep("finished", totals.finished()), new FunnelStep("shared", totals.rooms()));
	}

	private List<CategoryRow> categories() {
		return jdbcClient.sql("""
				SELECT c.code, c.name,
				       (SELECT COUNT(*) FROM category_answer a WHERE a.category_id = c.id),
				       (SELECT COUNT(*)
				        FROM (SELECT DISTINCT ON (guest_id) category_id
				              FROM category_answer
				              ORDER BY guest_id, completed_at, id) first
				        WHERE first.category_id = c.id)
				FROM category c
				ORDER BY c.sort_order
				""")
			.query((rs, i) -> new CategoryRow(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4)))
			.list();
	}

	private List<Demographic> demographics() {
		return jdbcClient.sql("""
				SELECT g.gender, g.age_group, COUNT(*), COUNT(o.guest_id)
				FROM guest g
				LEFT JOIN overall_answer o ON o.guest_id = g.id
				WHERE g.gender IS NOT NULL AND g.age_group IS NOT NULL
				GROUP BY g.gender, g.age_group
				""")
			.query((rs, i) -> new Demographic(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4)))
			.list();
	}

	private List<Long> hours(OffsetDateTime since) {
		long[] counts = new long[24];
		jdbcClient.sql("""
				SELECT EXTRACT(HOUR FROM completed_at AT TIME ZONE 'Asia/Seoul')::INT AS hour, COUNT(*)
				FROM category_answer
				WHERE completed_at >= :since
				GROUP BY hour
				""").param("since", since).query((rs) -> {
			counts[rs.getInt(1)] = rs.getLong(2);
		});
		List<Long> hours = new ArrayList<>();
		for (long count : counts) {
			hours.add(count);
		}
		return hours;
	}

	/** Every question with how its answers split, from the combination counts. */
	private List<QuestionRow> questions() {
		return jdbcClient.sql("""
				SELECT c.code, q.bit_position + 1, q.prompt, q.option_0, q.option_1,
				       COALESCE(SUM(s.participant_count) FILTER (WHERE (s.answer_bits >> q.bit_position) & 1 = 0), 0),
				       COALESCE(SUM(s.participant_count), 0)
				FROM question q
				JOIN category c ON c.id = q.category_id
				LEFT JOIN combination_stats s ON s.category_id = q.category_id
				GROUP BY c.code, c.sort_order, q.bit_position, q.prompt, q.option_0, q.option_1
				ORDER BY c.sort_order, q.bit_position
				""")
			.query((rs, i) -> new QuestionRow(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getString(4),
					rs.getString(5), rs.getLong(6), rs.getLong(7)))
			.list();
	}

}
