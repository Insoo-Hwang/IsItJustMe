package com.isitjustme.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Everything the admin page shows, read in one request so its numbers agree.
 *
 * @param days length of the period the daily numbers cover, ending today (Asia/Seoul)
 * @param totals counts since the service started
 * @param period counts inside the period, each with the same-length period before it
 * @param daily one entry per day of the period, oldest first
 * @param funnel how far guests got, each step a subset of the one before
 * @param progress guests by how many categories they finished, index 0 to the category count
 * @param hours category completions of the period by hour of day (Asia/Seoul), 24 entries
 */
public record AdminDashboard(Instant generatedAt, int days, Totals totals, Map<String, Change> period,
		List<Day> daily, List<FunnelStep> funnel, List<Long> progress, List<CategoryRow> categories,
		List<Demographic> demographics, List<Long> hours, List<QuestionRow> questions, List<AdRow> ads) {

	/**
	 * @param profiled guests who entered gender and age group
	 * @param started guests who finished at least one category
	 * @param finished guests who finished every category
	 * @param answers finished categories, over all guests
	 * @param rooms share links made
	 * @param planets friends who joined a taste universe
	 * @param roomsWithPlanets share links that brought at least one friend
	 */
	public record Totals(long guests, long profiled, long started, long finished, long answers, long rooms,
			long planets, long roomsWithPlanets) {
	}

	public record Change(long current, long previous) {
	}

	/**
	 * @param guests new guests
	 * @param answers categories finished
	 * @param finished guests who finished their last category
	 * @param events actions by {@code EventType} name; types with no action are left out
	 */
	public record Day(LocalDate date, long guests, long answers, long finished, long rooms, long planets,
			Map<String, Long> events) {
	}

	public record FunnelStep(String key, long count) {
	}

	/**
	 * @param participants guests who finished the category
	 * @param firstPicks guests who finished this category before any other
	 */
	public record CategoryRow(String code, String name, long participants, long firstPicks) {
	}

	/**
	 * @param finished of those guests, how many finished every category
	 */
	public record Demographic(String gender, String ageGroup, long guests, long finished) {
	}

	/**
	 * @param number 1 to 10 inside the category
	 * @param option0Count answers that picked option 0
	 */
	public record QuestionRow(String category, int number, String prompt, String option0, String option1,
			long option0Count, long total) {
	}

	/**
	 * Ad actions of the period in one category's test.
	 */
	public record AdRow(String category, long views, long clicks, long skips) {
	}

}
