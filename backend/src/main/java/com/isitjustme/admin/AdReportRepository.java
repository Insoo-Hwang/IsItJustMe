package com.isitjustme.admin;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.isitjustme.admin.AdReport.AdDay;
import com.isitjustme.admin.AdReport.AdStat;
import com.isitjustme.admin.AdReport.Audience;
import com.isitjustme.admin.AdReport.Cell;
import com.isitjustme.admin.AdReport.Retention;
import com.isitjustme.admin.AdReport.Slice;

import lombok.RequiredArgsConstructor;

/**
 * Reads the ad report from the raw ad actions in {@code event}, uncached like the
 * dashboard.
 */
@Repository
@RequiredArgsConstructor
public class AdReportRepository {

	private static final String COUNTS = """
			COUNT(*) FILTER (WHERE e.type = 'AD_VIEW'),
			COUNT(*) FILTER (WHERE e.type = 'AD_CLICK'),
			COUNT(*) FILTER (WHERE e.type = 'AD_SKIP')""";

	private final JdbcClient jdbcClient;

	/**
	 * @param ad one ad to break down, or empty for every ad together
	 */
	@Transactional(readOnly = true)
	public AdReport report(int days, LocalDate today, @Nullable String ad) {
		LocalDate from = today.minusDays(days - 1L);
		OffsetDateTime since = from.atStartOfDay(AdminDashboardRepository.ZONE).toOffsetDateTime();
		OffsetDateTime previousSince = from.minusDays(days)
			.atStartOfDay(AdminDashboardRepository.ZONE)
			.toOffsetDateTime();

		List<AdStat> ads = new ArrayList<>();
		AdStat total = new AdStat(null, 0, 0, 0, 0, 0, 0, 0, 0);
		// one row per ad, and the row with no ad is all of them together
		for (AdStat stat : jdbcClient.sql("""
				SELECT ad_id,
				       COUNT(*) FILTER (WHERE type = 'AD_VIEW' AND created_at >= :since),
				       COUNT(DISTINCT guest_id) FILTER (WHERE type = 'AD_VIEW' AND created_at >= :since),
				       COUNT(*) FILTER (WHERE type = 'AD_CLICK' AND created_at >= :since),
				       COUNT(DISTINCT guest_id) FILTER (WHERE type = 'AD_CLICK' AND created_at >= :since),
				       COUNT(*) FILTER (WHERE type = 'AD_SKIP' AND created_at >= :since),
				       COUNT(*) FILTER (WHERE type = 'AD_VIEW' AND placement = 'QUIZ_BREAK' AND created_at >= :since),
				       COUNT(*) FILTER (WHERE type = 'AD_VIEW' AND created_at < :since),
				       COUNT(*) FILTER (WHERE type = 'AD_CLICK' AND created_at < :since)
				FROM event
				WHERE ad_id IS NOT NULL AND created_at >= :previousSince
				GROUP BY GROUPING SETS ((ad_id), ())
				ORDER BY ad_id NULLS FIRST
				""")
			.param("since", since)
			.param("previousSince", previousSince)
			.query((rs, i) -> new AdStat(rs.getString(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5),
					rs.getLong(6), rs.getLong(7), rs.getLong(8), rs.getLong(9)))
			.list()) {
			if (stat.ad() == null) {
				total = stat;
			}
			else {
				ads.add(stat);
			}
		}

		Map<LocalDate, AdDay> byDay = new HashMap<>();
		select("SELECT (e.created_at AT TIME ZONE 'Asia/Seoul')::date AS day, %s %s GROUP BY day", "", since, ad)
			.query((rs) -> {
				LocalDate day = rs.getObject(1, LocalDate.class);
				byDay.put(day, new AdDay(day, rs.getLong(2), rs.getLong(3), rs.getLong(4)));
			});
		List<AdDay> daily = new ArrayList<>();
		for (LocalDate date = from; !date.isAfter(today); date = date.plusDays(1)) {
			daily.add(byDay.getOrDefault(date, new AdDay(date, 0, 0, 0)));
		}

		List<Audience> audiences = select(
				"SELECT g.gender, g.age_group, %s %s AND g.gender IS NOT NULL AND g.age_group IS NOT NULL "
						+ "GROUP BY g.gender, g.age_group",
				"JOIN guest g ON g.id = e.guest_id", since, ad)
			.query((rs, i) -> new Audience(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4),
					rs.getLong(5)))
			.list();

		List<Slice> categories = select(
				"SELECT e.category_code, %s %s AND e.category_code IS NOT NULL GROUP BY e.category_code", "", since, ad)
			.query(AdReportRepository::slice)
			.list();

		long[][] hourCounts = new long[24][3];
		select("SELECT EXTRACT(HOUR FROM e.created_at AT TIME ZONE 'Asia/Seoul')::INT AS hour, %s %s GROUP BY hour", "",
				since, ad)
			.query((rs) -> {
				hourCounts[rs.getInt(1)] = new long[] { rs.getLong(2), rs.getLong(3), rs.getLong(4) };
			});
		List<Slice> hours = new ArrayList<>();
		for (int hour = 0; hour < 24; hour++) {
			hours.add(new Slice(String.valueOf(hour), hourCounts[hour][0], hourCounts[hour][1], hourCounts[hour][2]));
		}

		List<Slice> placements = select("SELECT e.placement, %s %s AND e.placement IS NOT NULL GROUP BY e.placement",
				"", since, ad)
			.query(AdReportRepository::slice)
			.list();

		List<Cell> matrix = jdbcClient.sql("""
				SELECT ad_id, placement,
				       COUNT(*) FILTER (WHERE type = 'AD_VIEW'),
				       COUNT(*) FILTER (WHERE type = 'AD_CLICK')
				FROM event
				WHERE ad_id IS NOT NULL AND placement IS NOT NULL AND created_at >= :since
				GROUP BY ad_id, placement
				""")
			.param("since", since)
			.query((rs, i) -> new Cell(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getLong(4)))
			.list();

		return new AdReport(Instant.now(), days, ad, ads, total, daily, audiences, categories, hours, placements,
				matrix, retention(since, ad));
	}

	/**
	 * Whether a test is still finished once an ad has interrupted it: the first view of the
	 * ad in the middle of a test per visitor and test, and whether that test was completed
	 * after it. Ads under a result are left out; they show after the test is done.
	 */
	private Retention retention(OffsetDateTime since, @Nullable String ad) {
		StatementSpec spec = jdbcClient.sql("""
				SELECT COUNT(*),
				       COUNT(*) FILTER (WHERE EXISTS (
				           SELECT 1 FROM category_answer a JOIN category c ON c.id = a.category_id
				           WHERE a.guest_id = v.guest_id AND c.code = v.category_code AND a.completed_at >= v.seen))
				FROM (SELECT e.guest_id, e.category_code, MIN(e.created_at) AS seen
				      FROM event e
				      WHERE e.type = 'AD_VIEW' AND e.placement = 'QUIZ_BREAK' AND e.created_at >= :since
				        AND e.guest_id IS NOT NULL AND e.category_code IS NOT NULL %s
				      GROUP BY e.guest_id, e.category_code) v
				""".formatted(ad == null ? "" : "AND e.ad_id = :ad")).param("since", since);
		if (ad != null) {
			spec = spec.param("ad", ad);
		}
		return spec.query((rs, i) -> new Retention(rs.getLong(1), rs.getLong(2))).single();
	}

	/**
	 * Ad actions of the period, of one ad when given. {@code sql} has a {@code %s} for the
	 * counts and one for the FROM and WHERE, in that order; it and {@code join} are
	 * constants from this class, never input.
	 */
	private StatementSpec select(String sql, String join, OffsetDateTime since, @Nullable String ad) {
		String from = "FROM event e " + join + " WHERE e.ad_id IS NOT NULL AND e.created_at >= :since"
				+ (ad == null ? "" : " AND e.ad_id = :ad");
		StatementSpec spec = jdbcClient.sql(sql.formatted(COUNTS, from)).param("since", since);
		return ad == null ? spec : spec.param("ad", ad);
	}

	private static Slice slice(ResultSet rs, int row) throws SQLException {
		return new Slice(rs.getString(1), rs.getLong(2), rs.getLong(3), rs.getLong(4));
	}

}
