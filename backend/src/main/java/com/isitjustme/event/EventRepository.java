package com.isitjustme.event;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class EventRepository {

	/** Views of the same ad by the same visitor in this span count once. */
	static final Duration VIEW_WINDOW = Duration.ofMinutes(30);

	private final JdbcClient jdbcClient;

	/**
	 * @param guestId empty for a visitor without a session
	 * @param categoryCode the category the action happened in, when it has one
	 */
	public void save(@Nullable Long guestId, EventType type, @Nullable String categoryCode, Instant at) {
		save(guestId, type, categoryCode, null, null, at);
	}

	/**
	 * @param adId the ad an ad action was about
	 * @param placement where that ad was shown
	 */
	public void save(@Nullable Long guestId, EventType type, @Nullable String categoryCode, @Nullable String adId,
			@Nullable AdPlacement placement, Instant at) {
		// A view the same visitor already had in the last half hour (same ad, spot and test)
		// is not stored again: reloading a page must not count as being shown the ad twice.
		jdbcClient.sql("""
				INSERT INTO event (guest_id, type, category_code, ad_id, placement, created_at)
				SELECT :guestId, :type, :category, :ad, :placement, :createdAt
				WHERE :type <> 'AD_VIEW' OR CAST(:guestId AS BIGINT) IS NULL OR NOT EXISTS (
				    SELECT 1 FROM event
				    WHERE type = 'AD_VIEW' AND guest_id = :guestId AND ad_id = :ad
				      AND placement IS NOT DISTINCT FROM :placement
				      AND category_code IS NOT DISTINCT FROM :category
				      AND created_at > :since)
				""")
			.param("guestId", guestId, Types.BIGINT)
			.param("type", type.name())
			.param("category", categoryCode, Types.VARCHAR)
			.param("ad", adId, Types.VARCHAR)
			.param("placement", placement == null ? null : placement.name(), Types.VARCHAR)
			.param("createdAt", Timestamp.from(at))
			.param("since", Timestamp.from(at.minus(VIEW_WINDOW)))
			.update();
	}

}
