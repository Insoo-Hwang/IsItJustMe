package com.isitjustme.category;

import java.sql.Array;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.isitjustme.category.CategoryStatsCache.OverallBitStats;
import com.isitjustme.category.CategoryStatsCache.OverallRanks;
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
	 * Scores every guest inside the database and reads back the sorted scores, or an even
	 * sample of them once there are more than {@link OverallRanks#MAX_SAMPLES}.
	 */
	OverallRanks ranks() {
		return ranks(OverallRanks.MAX_SAMPLES);
	}

	OverallRanks ranks(int maxSamples) {
		OverallBitStats stats = bitStats();
		long[] weights = RarityCalculator.rarityWeights(stats.participants(), stats.oneCounts(),
				stats.oneCounts().length);
		int step = OverallRanks.stepFor(stats.participants(), maxSamples);
		// the total comes from the same scan as the scores, so the two always agree
		List<long[]> rows = jdbcClient.sql("""
				SELECT score, total
				FROM (SELECT score, ROW_NUMBER() OVER (ORDER BY score) - 1 AS position, COUNT(*) OVER () AS total
				      FROM (SELECT %s AS score FROM overall_answer) s) r
				WHERE position %% :step = 0
				ORDER BY position
				""".formatted(scoreExpression(weights)))
			.param("step", step)
			.query((rs, i) -> new long[] { rs.getLong(1), rs.getLong(2) })
			.list();
		long participants = rows.isEmpty() ? 0 : rows.getFirst()[1];
		return new OverallRanks(stats.takenAt(), participants, weights, step,
				rows.stream().mapToLong((row) -> row[0]).toArray());
	}

	/**
	 * {@link RarityCalculator#rarityScore} as one flat BIGINT sum over {@code overall_bits}.
	 * The weights are numbers computed here, never input, so they go in as literals: a
	 * per-row subquery over an array parameter cost about 35 times as much.
	 */
	private static String scoreExpression(long[] weights) {
		String sum = IntStream.range(0, weights.length)
			.filter((bit) -> weights[bit] != 0)
			.mapToObj((bit) -> "((overall_bits >> %d) & 1) * (%d)".formatted(bit, weights[bit]))
			.collect(Collectors.joining(" + "));
		return sum.isEmpty() ? "0::BIGINT" : sum;
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
