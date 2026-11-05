package com.isitjustme.category;

import java.sql.Array;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.isitjustme.category.CategoryStatsCache.OverallBitStats;
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
	 * The per-bit counts kept by the {@code overall_stats} triggers, read as one row.
	 */
	OverallBitStats bitStats() {
		Instant takenAt = Instant.now();
		return jdbcClient.sql("SELECT participants, one_counts FROM overall_stats WHERE id = 1")
			.query((rs, i) -> new OverallBitStats(takenAt, rs.getLong(1), longs(rs.getArray(2))))
			.single();
	}

	private static long[] longs(Array array) throws SQLException {
		Long[] boxed = (Long[]) array.getArray();
		long[] values = new long[boxed.length];
		for (int i = 0; i < boxed.length; i++) {
			values[i] = boxed[i];
		}
		return values;
	}

	/**
	 * Guests whose {@link RarityCalculator#rarityScore} is below {@code myScore}, scored
	 * inside the database with the same weights.
	 */
	long countRarer(long[] weights, long myScore) {
		return jdbcClient.sql("""
				SELECT COUNT(*)
				FROM overall_answer o
				WHERE COALESCE((SELECT SUM(w.weight)
				                FROM unnest(CAST(:weights AS BIGINT[])) WITH ORDINALITY AS w (weight, i)
				                WHERE (o.overall_bits >> (w.i - 1)::INT) & 1 = 1), 0) < :myScore
				""")
			.param("weights", Arrays.stream(weights).mapToObj(Long::toString).collect(Collectors.joining(",", "{", "}")))
			.param("myScore", myScore)
			.query(Long.class)
			.single();
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
