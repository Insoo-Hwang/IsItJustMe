package com.isitjustme.mvp;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * Addresses of guests who want to hear when the overall numbers open. Only the admin
 * reads them, to send that one notice by hand.
 */
@Repository
@RequiredArgsConstructor
public class NotifyEmailRepository {

	private final JdbcClient jdbcClient;

	/** Saves the guest's address, replacing the one they left before. */
	public void save(long guestId, String email, Instant at) {
		jdbcClient.sql("""
				INSERT INTO notify_email (guest_id, email, created_at) VALUES (:guestId, :email, :at)
				ON CONFLICT (guest_id) DO UPDATE SET email = EXCLUDED.email, created_at = EXCLUDED.created_at
				""").param("guestId", guestId).param("email", email).param("at", Timestamp.from(at)).update();
	}

	public long count() {
		return jdbcClient.sql("SELECT COUNT(*) FROM notify_email").query(Long.class).single();
	}

	/** Every address once, oldest first. */
	public List<NotifyEmail> findAll() {
		return jdbcClient.sql("""
				SELECT email, MIN(created_at) AS created_at FROM notify_email
				GROUP BY email ORDER BY MIN(created_at)
				""").query(NotifyEmail.class).list();
	}

	public record NotifyEmail(String email, Instant createdAt) {
	}

}
