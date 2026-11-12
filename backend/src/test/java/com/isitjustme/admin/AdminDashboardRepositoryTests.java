package com.isitjustme.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.isitjustme.admin.AdminDashboard.CategoryRow;
import com.isitjustme.admin.AdminDashboard.Day;
import com.isitjustme.admin.AdminDashboard.Demographic;
import com.isitjustme.admin.AdminDashboard.FunnelStep;
import com.isitjustme.admin.AdminDashboard.QuestionRow;
import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.category.CombinationStatsRepository;
import com.isitjustme.category.OverallAnswerRepository;
import com.isitjustme.category.OverallRanksHolder;
import com.isitjustme.event.EventRepository;
import com.isitjustme.event.EventType;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestService;

@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ AdminDashboardRepository.class, EventRepository.class, CategoryService.class, CategoryStatsCache.class,
		CombinationStatsRepository.class, OverallAnswerRepository.class, OverallRanksHolder.class,
		GuestService.class })
class AdminDashboardRepositoryTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	private static final List<String> CATEGORY_CODES = List.of("food", "love", "life", "travel", "spending", "people");

	@Autowired
	private AdminDashboardRepository dashboardRepository;

	@Autowired
	private EventRepository eventRepository;

	@Autowired
	private CategoryService categoryService;

	@Autowired
	private GuestService guestService;

	@Autowired
	private JdbcClient jdbcClient;

	@Test
	void countsGuestsByHowFarTheyGot() {
		guestService.resolveOrIssue(null);
		guest(Gender.FEMALE);
		String one = guest(Gender.FEMALE);
		categoryService.submit(one, "love", 0b1);
		String all = guest(Gender.MALE);
		CATEGORY_CODES.forEach((code) -> categoryService.submit(all, code, 0b11));

		AdminDashboard dashboard = dashboardRepository.dashboard(7, today());

		assertThat(dashboard.totals().guests()).isEqualTo(4);
		assertThat(dashboard.totals().profiled()).isEqualTo(3);
		assertThat(dashboard.totals().started()).isEqualTo(2);
		assertThat(dashboard.totals().finished()).isEqualTo(1);
		assertThat(dashboard.totals().answers()).isEqualTo(7);
		assertThat(dashboard.progress()).containsExactly(2L, 1L, 0L, 0L, 0L, 0L, 1L);
		assertThat(dashboard.funnel()).extracting(FunnelStep::key, FunnelStep::count)
			.containsExactly(tuple("visited", 4L), tuple("profiled", 3L), tuple("started", 2L), tuple("halfway", 1L),
					tuple("finished", 1L), tuple("shared", 0L));
		assertThat(dashboard.categories()).filteredOn((c) -> c.code().equals("love"))
			.extracting(CategoryRow::participants, CategoryRow::firstPicks)
			.containsExactly(tuple(2L, 1L));
		assertThat(dashboard.demographics()).extracting(Demographic::gender, Demographic::guests, Demographic::finished)
			.containsExactlyInAnyOrder(tuple("FEMALE", 2L, 0L), tuple("MALE", 1L, 1L));
	}

	@Test
	void splitsThePeriodFromTheOneBefore() {
		guest(Gender.FEMALE);
		eventRepository.save(null, EventType.AD_VIEW, "food", Instant.now());
		eventRepository.save(null, EventType.AD_VIEW, "food", Instant.now());
		eventRepository.save(null, EventType.AD_CLICK, "food", Instant.now());
		// eight days ago: outside a 7 day period, inside the one before it
		jdbcClient
			.sql("INSERT INTO event (type, category_code, created_at) VALUES ('AD_VIEW', 'love', now() - INTERVAL '8 days')")
			.update();

		AdminDashboard dashboard = dashboardRepository.dashboard(7, today());

		assertThat(dashboard.daily()).hasSize(7);
		Day last = dashboard.daily().getLast();
		assertThat(last.date()).isEqualTo(today());
		assertThat(last.guests()).isEqualTo(1);
		assertThat(last.events()).containsEntry("AD_VIEW", 2L).containsEntry("AD_CLICK", 1L);
		assertThat(dashboard.period().get("AD_VIEW").current()).isEqualTo(2);
		assertThat(dashboard.period().get("AD_VIEW").previous()).isEqualTo(1);
		assertThat(dashboard.period().get("guests").current()).isEqualTo(1);
	}

	@Test
	void splitsEveryQuestionByOption() {
		String a = guest(Gender.FEMALE);
		String b = guest(Gender.MALE);
		String c = guest(Gender.MALE);
		categoryService.submit(a, "food", 0b0);
		categoryService.submit(b, "food", 0b1);
		categoryService.submit(c, "food", 0b1);

		AdminDashboard dashboard = dashboardRepository.dashboard(7, today());

		assertThat(dashboard.questions()).hasSize(60);
		QuestionRow first = dashboard.questions().getFirst();
		assertThat(first.category()).isEqualTo("food");
		assertThat(first.number()).isEqualTo(1);
		assertThat(first.option0Count()).isEqualTo(1);
		assertThat(first.total()).isEqualTo(3);
		assertThat(dashboard.questions().get(1).option0Count()).isEqualTo(3);
		assertThat(dashboard.questions().getLast().total()).isZero();
		assertThat(dashboard.hours().stream().mapToLong(Long::longValue).sum()).isEqualTo(3);
	}

	private String guest(Gender gender) {
		String token = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(token, new GuestProfile(gender, AgeGroup.TWENTIES));
		return token;
	}

	private static LocalDate today() {
		return LocalDate.now(AdminDashboardRepository.ZONE);
	}

}
