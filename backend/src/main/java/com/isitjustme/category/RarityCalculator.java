package com.isitjustme.category;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.isitjustme.category.CombinationStatsRepository.StatsRow;

/**
 * Computes result numbers from one version's combination counts. The counts already
 * include the requesting guest's own answer.
 */
final class RarityCalculator {

	static final int QUESTION_COUNT = 10;

	static final int SIMILAR_MAX_DIFFERENCES = 2;

	/** Two or fewer matching answers. */
	static final int OPPOSITE_MIN_DIFFERENCES = QUESTION_COUNT - 2;

	private RarityCalculator() {
	}

	static Summary summarize(List<StatsRow> rows, int myBits) {
		Map<Integer, Long> byCombination = new HashMap<>();
		rows.forEach((row) -> byCombination.merge(row.answerBits(), row.count(), Long::sum));

		long participants = byCombination.values().stream().mapToLong(Long::longValue).sum();
		if (participants == 0) {
			return new Summary(0, 0, 0, 0, 0);
		}
		long mine = byCombination.getOrDefault(myBits, 0L);
		long similar = 0;
		long opposite = 0;
		long different = 0;
		for (Map.Entry<Integer, Long> entry : byCombination.entrySet()) {
			int differences = Integer.bitCount(entry.getKey() ^ myBits);
			if (differences <= SIMILAR_MAX_DIFFERENCES) {
				similar += entry.getValue();
			}
			if (differences >= OPPOSITE_MIN_DIFFERENCES) {
				opposite += entry.getValue();
			}
			if (differences == QUESTION_COUNT) {
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
	 * @param participants answers in this version
	 * @param exact other participants with identical answers
	 * @param similar % of other participants matching at least 8 of 10 answers
	 * @param opposite % of other participants matching at most 2 of 10 answers
	 * @param different other participants with every answer the other way
	 */
	record Summary(long participants, long exact, double similar, double opposite, long different) {
	}

}
