package com.isitjustme.mvp;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import com.isitjustme.category.CategoryStatsCache;

/**
 * MVP mode: while it is on and fewer than {@code goal} guests finished every test, the
 * numbers that compare a guest with everyone else stay hidden. The admin page switches it;
 * the switch is stored in the DB, so a restart keeps it.
 */
@Component
public class MvpMode {

	static final String SETTING = "mvp_enabled";

	private final JdbcClient jdbcClient;

	private final CategoryStatsCache statsCache;

	private final int goal;

	public MvpMode(JdbcClient jdbcClient, CategoryStatsCache statsCache, @Value("${site.mvp-goal:300}") int goal) {
		this.jdbcClient = jdbcClient;
		this.statsCache = statsCache;
		this.goal = goal;
	}

	public State state() {
		boolean enabled = enabled();
		// cached for a short while, so the numbers open a little after the goal is reached
		long completers = statsCache.overallBitStats().participants();
		return new State(enabled, enabled && completers < goal, goal, completers);
	}

	public boolean locked() {
		return state().locked();
	}

	public State set(boolean enabled) {
		jdbcClient.sql("""
				INSERT INTO site_setting (name, value, updated_at) VALUES (:name, :value, :at)
				ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
				""").param("name", SETTING).param("value", String.valueOf(enabled)).param("at", Timestamp.from(Instant.now())).update();
		return state();
	}

	private boolean enabled() {
		return jdbcClient.sql("SELECT value FROM site_setting WHERE name = :name")
			.param("name", SETTING)
			.query(String.class)
			.optional()
			.map(Boolean::parseBoolean)
			.orElse(false);
	}

	/**
	 * @param enabled whether the admin keeps MVP mode on
	 * @param locked whether the overall numbers are hidden right now
	 * @param goal guests who must finish every test before the numbers open
	 * @param completers guests who finished every test
	 */
	public record State(boolean enabled, boolean locked, int goal, long completers) {
	}

}
