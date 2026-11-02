package com.isitjustme.category;

import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.isitjustme.category.RarityCalculator.Counts;

import lombok.RequiredArgsConstructor;

/**
 * Each complete guest's answers as one combination. Written in the same transaction as
 * {@code category_answer}, so it can always be rebuilt from that table.
 */
@Repository
@RequiredArgsConstructor
public class OverallAnswerRepository {

	private final JdbcClient jdbcClient;

	void save(Long guestId, long overallBits) {
		jdbcClient.sql("""
				INSERT INTO overall_answer (guest_id, overall_bits) VALUES (:guestId, :overallBits)
				ON CONFLICT (guest_id) DO UPDATE SET overall_bits = EXCLUDED.overall_bits
				""")
			.param("guestId", guestId)
			.param("overallBits", overallBits)
			.update();
	}

	Optional<Long> findBits(Long guestId) {
		return jdbcClient.sql("SELECT overall_bits FROM overall_answer WHERE guest_id = :guestId")
			.param("guestId", guestId)
			.query(Long.class)
			.optional();
	}

	/**
	 * Counts every combination against mine inside the database, so only the totals are
	 * read back.
	 */
	Counts count(long myBits, int questionCount) {
		return jdbcClient.sql("""
				SELECT COUNT(*),
				       COUNT(*) FILTER (WHERE d = 0),
				       COUNT(*) FILTER (WHERE d <= :similarMax),
				       COUNT(*) FILTER (WHERE d >= :oppositeMin),
				       COUNT(*) FILTER (WHERE d = :questionCount)
				FROM (SELECT BIT_COUNT((overall_bits # :myBits)::BIT(64)) AS d FROM overall_answer) o
				""")
			.param("myBits", myBits)
			.param("similarMax", RarityCalculator.similarMaxDifferences(questionCount))
			.param("oppositeMin", RarityCalculator.oppositeMinDifferences(questionCount))
			.param("questionCount", questionCount)
			.query((rs, i) -> new Counts(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)))
			.single();
	}

}
