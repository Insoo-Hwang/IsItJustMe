package com.isitjustme.category;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.isitjustme.category.CombinationStatsRepository.StatsRow;

/**
 * Computes result numbers from combination counts. The counts already
 * include the requesting guest's own answer.
 */
final class RarityCalculator {

	static final int QUESTION_COUNT = 10;

	private RarityCalculator() {
	}

	static Summary summarize(List<StatsRow> rows, int myBits) {
		Map<Long, Long> byCombination = new HashMap<>();
		rows.forEach((row) -> byCombination.merge((long) row.answerBits(), row.count(), Long::sum));
		return summarize(byCombination, myBits, QUESTION_COUNT);
	}

	/**
	 * Similar means at least 80% of the answers match, opposite at most 20%.
	 * @param byCombination participants per answer combination, one bit per question
	 */
	static Summary summarize(Map<Long, Long> byCombination, long myBits, int questionCount) {
		long participants = byCombination.values().stream().mapToLong(Long::longValue).sum();
		if (participants == 0) {
			return new Summary(0, 0, 0, 0, 0);
		}
		int similarMaxDifferences = questionCount / 5;
		int oppositeMinDifferences = questionCount - questionCount / 5;
		long mine = byCombination.getOrDefault(myBits, 0L);
		long similar = 0;
		long opposite = 0;
		long different = 0;
		for (Map.Entry<Long, Long> entry : byCombination.entrySet()) {
			int differences = Long.bitCount(entry.getKey() ^ myBits);
			if (differences <= similarMaxDifferences) {
				similar += entry.getValue();
			}
			if (differences >= oppositeMinDifferences) {
				opposite += entry.getValue();
			}
			if (differences == questionCount) {
				different += entry.getValue();
			}
		}
		long others = participants - 1;
		double similarRate = (others > 0) ? round1(Math.max(0, similar - 1) * 100.0 / others) : 0;
		double oppositeRate = (others > 0) ? round1(opposite * 100.0 / others) : 0;
		return new Summary(participants, Math.max(0, mine - 1), similarRate, oppositeRate, different);
	}

	private static double round1(double value) {
		return Math.round(value * 10) / 10.0;
	}

	/**
	 * @param participants participants compared, including me
	 * @param exact other participants with identical answers
	 * @param similar % of other participants matching at least 80% of the answers
	 * @param opposite % of other participants matching at most 20% of the answers
	 * @param different other participants with every answer the other way
	 */
	record Summary(long participants, long exact, double similar, double opposite, long different) {
	}

}
