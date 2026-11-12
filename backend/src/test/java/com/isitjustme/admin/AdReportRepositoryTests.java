package com.isitjustme.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import java.time.Instant;
import java.time.LocalDate;

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

import com.isitjustme.admin.AdReport.AdStat;
import com.isitjustme.admin.AdReport.Audience;
import com.isitjustme.admin.AdReport.Slice;
import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.category.CombinationStatsRepository;
import com.isitjustme.category.OverallAnswerRepository;
import com.isitjustme.category.OverallRanksHolder;
import com.isitjustme.event.AdPlacement;
import com.isitjustme.event.EventRepository;
import com.isitjustme.event.EventType;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestService;

@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ AdReportRepository.class, EventRepository.class, CategoryService.class, CategoryStatsCache.class,
		CombinationStatsRepository.class, OverallAnswerRepository.class, OverallRanksHolder.class,
		GuestService.class })
class AdReportRepositoryTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	@Autowired
	private AdReportRepository reportRepository;

	@Autowired
	private EventRepository eventRepository;

	@Autowired
	private CategoryService categoryService;

	@Autowired
	private GuestService guestService;

	@Autowired
	private JdbcClient jdbcClient;

	@Test
	void countsEveryAdAndAllOfThemTogether() {
		long woman = guestId(guest(Gender.FEMALE));
		long man = guestId(guest(Gender.MALE));
		ad(woman, EventType.AD_VIEW, "swiswi-01");
		ad(woman, EventType.AD_CLICK, "swiswi-01");
		ad(woman, EventType.AD_VIEW, "swiswi-02");
		ad(man, EventType.AD_VIEW, "swiswi-01");
		ad(man, EventType.AD_SKIP, "swiswi-01");
		// eight days ago: in the period before a 7 day one
		jdbcClient.sql("""
				INSERT INTO event (guest_id, type, category_code, ad_id, placement, created_at)
				VALUES (:guest, 'AD_VIEW', 'food', 'swiswi-01', 'QUIZ_BREAK', now() - INTERVAL '8 days')
				""").param("guest", man).update();

		AdReport report = reportRepository.report(7, today(), null);

		assertThat(report.ads()).extracting(AdStat::ad, AdStat::views, AdStat::reach, AdStat::clicks, AdStat::skips,
				AdStat::previousViews)
			.containsExactly(tuple("swiswi-01", 2L, 2L, 1L, 1L, 1L), tuple("swiswi-02", 1L, 1L, 0L, 0L, 0L));
		// the same visitor seeing two ads is reached once
		assertThat(report.total().views()).isEqualTo(3);
		assertThat(report.total().reach()).isEqualTo(2);
		assertThat(report.total().clickers()).isEqualTo(1);
		assertThat(report.daily()).hasSize(7);
		assertThat(report.daily().getLast().views()).isEqualTo(3);
		assertThat(report.audiences()).extracting(Audience::gender, Audience::views, Audience::clicks)
			.containsExactlyInAnyOrder(tuple("FEMALE", 2L, 1L), tuple("MALE", 1L, 0L));
		assertThat(report.placements()).extracting(Slice::key, Slice::views)
			.containsExactly(tuple("QUIZ_BREAK", 3L));
		assertThat(report.hours()).hasSize(24);
		assertThat(report.hours().stream().mapToLong(Slice::views).sum()).isEqualTo(3);
	}

	@Test
	void breaksDownOneAd() {
		long woman = guestId(guest(Gender.FEMALE));
		ad(woman, EventType.AD_VIEW, "swiswi-01");
		ad(woman, EventType.AD_VIEW, "swiswi-02");
		ad(woman, EventType.AD_CLICK, "swiswi-02");

		AdReport report = reportRepository.report(7, today(), "swiswi-02");

		assertThat(report.ad()).isEqualTo("swiswi-02");
		// the list still has every ad, so the page can offer the others
		assertThat(report.ads()).hasSize(2);
		assertThat(report.daily().getLast().views()).isEqualTo(1);
		assertThat(report.daily().getLast().clicks()).isEqualTo(1);
		assertThat(report.categories()).extracting(Slice::key, Slice::views, Slice::clicks)
			.containsExactly(tuple("food", 1L, 1L));
	}

	@Test
	void countsTestsFinishedAfterTheAd() {
		String finisher = guest(Gender.FEMALE);
		String quitter = guest(Gender.MALE);
		ad(guestId(finisher), EventType.AD_VIEW, "swiswi-01");
		ad(guestId(quitter), EventType.AD_VIEW, "swiswi-01");
		categoryService.submit(finisher, "food", 0b1);

		AdReport report = reportRepository.report(7, today(), null);

		assertThat(report.retention().viewed()).isEqualTo(2);
		assertThat(report.retention().finished()).isEqualTo(1);
	}

	@Test
	void storesARepeatedViewOnce() {
		long woman = guestId(guest(Gender.FEMALE));
		ad(woman, EventType.AD_VIEW, "swiswi-01");
		// the page reloaded: same visitor, ad, spot and test
		ad(woman, EventType.AD_VIEW, "swiswi-01");
		// another test is another view
		eventRepository.save(woman, EventType.AD_VIEW, "love", "swiswi-01", AdPlacement.QUIZ_BREAK,
				Instant.now().minusSeconds(1));
		// clicks are never merged
		ad(woman, EventType.AD_CLICK, "swiswi-01");
		ad(woman, EventType.AD_CLICK, "swiswi-01");

		AdReport report = reportRepository.report(7, today(), null);

		assertThat(report.total().views()).isEqualTo(2);
		assertThat(report.total().clicks()).isEqualTo(2);
	}

	@Test
	void skipsAndFinishingCountOnlyTheAdInTheMiddleOfATest() {
		String guest = guest(Gender.FEMALE);
		long id = guestId(guest);
		ad(id, EventType.AD_VIEW, "swiswi-01");
		ad(id, EventType.AD_SKIP, "swiswi-01");
		categoryService.submit(guest, "food", 0b1);
		// the card under the result shows after the test is done
		eventRepository.save(id, EventType.AD_VIEW, "food", "swiswi-01", AdPlacement.RESULT_BANNER, Instant.now());

		AdReport report = reportRepository.report(7, today(), null);

		assertThat(report.total().views()).isEqualTo(2);
		assertThat(report.total().skippableViews()).isEqualTo(1);
		assertThat(report.retention().viewed()).isEqualTo(1);
		assertThat(report.retention().finished()).isEqualTo(1);
		assertThat(report.matrix()).extracting(AdReport.Cell::placement, AdReport.Cell::views)
			.containsExactlyInAnyOrder(tuple("QUIZ_BREAK", 1L), tuple("RESULT_BANNER", 1L));
	}

	private void ad(long guestId, EventType type, String ad) {
		eventRepository.save(guestId, type, "food", ad, AdPlacement.QUIZ_BREAK, Instant.now().minusSeconds(1));
	}

	private String guest(Gender gender) {
		String token = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(token, new GuestProfile(gender, AgeGroup.TWENTIES));
		return token;
	}

	private long guestId(String token) {
		return guestService.findByToken(token).orElseThrow().getId();
	}

	private static LocalDate today() {
		return LocalDate.now(AdminDashboardRepository.ZONE);
	}

}
