package com.isitjustme.event;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class EventRepository {

	private final JdbcClient jdbcClient;

	/**
	 * @param guestId empty for a visitor without a session
	 * @param categoryCode the category the action happened in, when it has one
	 */
	public void save(@Nullable Long guestId, EventType type, @Nullable String categoryCode, Instant at) {
		jdbcClient.sql("""
				INSERT INTO event (guest_id, type, category_code, created_at)
				VALUES (:guestId, :type, :category, :createdAt)
				""")
			.param("guestId", guestId, Types.BIGINT)
			.param("type", type.name())
			.param("category", categoryCode, Types.VARCHAR)
			.param("createdAt", Timestamp.from(at))
			.update();
	}

}
