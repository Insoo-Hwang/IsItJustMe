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

	private RarityCalculator() {
	}

	static Summary summarize(List<StatsRow> rows, int myBits) {
		Map<Integer, Long> byCombination = new HashMap<>();
		rows.forEach((row) -> byCombination.merge(row.answerBits(), row.count(), Long::sum));

		long participants = byCombination.values().stream().mapToLong(Long::longValue).sum();
		if (participants == 0) {
			return new Summary(0, 0, 0, 0);
		}
		long mine = byCombination.getOrDefault(myBits, 0L);
		long similar = 0;
		long asRareOrRarer = 0;
		for (Map.Entry<Integer, Long> entry : byCombination.entrySet()) {
			if (Integer.bitCount(entry.getKey() ^ myBits) <= SIMILAR_MAX_DIFFERENCES) {
				similar += entry.getValue();
			}
			if (entry.getValue() <= mine) {
				asRareOrRarer += entry.getValue();
			}
		}
		long others = participants - 1;
		double similarRate = (others > 0) ? round1(Math.max(0, similar - 1) * 100.0 / others) : 0;
		int top = (int) Math.clamp(Math.round(asRareOrRarer * 100.0 / participants), 1, 100);
		return new Summary(participants, Math.max(0, mine - 1), similarRate, top);
	}

	private static double round1(double value) {
		return Math.round(value * 10) / 10.0;
	}

	/**
	 * @param participants answers in this version
	 * @param exact other participants with identical answers
	 * @param similar % of other participants matching at least 8 of 10 answers
	 * @param top % of participants whose combination is as rare as mine or rarer
	 */
	record Summary(long participants, long exact, double similar, int top) {
	}

}
