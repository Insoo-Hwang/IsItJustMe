package com.isitjustme.admin;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * How the ads did over one period, for the operator and for the advertiser. The
 * breakdowns follow {@link #ad()}: one ad, or every ad together when it is empty.
 *
 * @param ads every ad shown in the period or the one before, the selection aside
 * @param total every ad together; its reach counts each visitor once across ads
 * @param matrix every ad in every placement, the selection aside
 * @param retention visitors whose test an ad interrupted, and how many finished that test
 */
public record AdReport(Instant generatedAt, int days, @Nullable String ad, List<AdStat> ads, AdStat total,
		List<AdDay> daily, List<Audience> audiences, List<Slice> categories, List<Slice> hours, List<Slice> placements,
		List<Cell> matrix, Retention retention) {

	/**
	 * @param reach visitors who saw the ad at least once
	 * @param clickers visitors who opened it at least once
	 * @param skippableViews views in the one placement with a skip button, the base of the
	 * skip rate
	 * @param previousViews views in the same-length period before
	 */
	public record AdStat(@Nullable String ad, long views, long reach, long clicks, long clickers, long skips,
			long skippableViews, long previousViews, long previousClicks) {
	}

	/** One ad in one placement. */
	public record Cell(String ad, String placement, long views, long clicks) {
	}

	public record AdDay(LocalDate date, long views, long clicks, long skips) {
	}

	/** Ad actions of visitors with one profile. */
	public record Audience(String gender, String ageGroup, long views, long clicks, long skips) {
	}

	/**
	 * Ad actions grouped by one thing: a category code, an hour of day (0 to 23, Korean
	 * time) or a placement.
	 */
	public record Slice(String key, long views, long clicks, long skips) {
	}

	/**
	 * Only the ad in the middle of a test counts here: the other placements show after the
	 * test is already finished.
	 *
	 * @param viewed visitor and test pairs whose test an ad interrupted
	 * @param finished of those, pairs where the test was finished after the ad
	 */
	public record Retention(long viewed, long finished) {
	}

}
