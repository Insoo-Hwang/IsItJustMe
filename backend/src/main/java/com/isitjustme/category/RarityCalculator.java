package com.isitjustme.category;

import org.jspecify.annotations.Nullable;

/**
 * Computes result numbers from combination counts. The counts already
 * include the requesting guest's own answer.
 */
final class RarityCalculator {

	static final int QUESTION_COUNT = 10;

	static final int COMBINATIONS = 1 << QUESTION_COUNT;

	private RarityCalculator() {
	}

	/**
	 * Similar means at least 80% of the answers match, opposite at most 20%.
	 * @param byCombination participants per answer combination, indexed by answer bits
	 */
	static Summary summarize(long[] byCombination, int myBits) {
		long participants = 0;
		long similar = 0;
		long opposite = 0;
		long different = 0;
		for (int bits = 0; bits < byCombination.length; bits++) {
			long count = byCombination[bits];
			if (count == 0) {
				continue;
			}
			int differences = Integer.bitCount(bits ^ myBits);
			participants += count;
			if (differences <= similarMaxDifferences(QUESTION_COUNT)) {
				similar += count;
			}
			if (differences >= oppositeMinDifferences(QUESTION_COUNT)) {
				opposite += count;
			}
			if (differences == QUESTION_COUNT) {
				different += count;
			}
		}
		return summarize(new Counts(participants, byCombination[myBits], similar, opposite, different));
	}

	static Summary summarize(Counts counts) {
		if (counts.participants() == 0) {
			return new Summary(0, 0, 0, 0, 0);
		}
		long others = counts.participants() - 1;
		double similarRate = (others > 0) ? round1(Math.max(0, counts.similar() - 1) * 100.0 / others) : 0;
		double oppositeRate = (others > 0) ? round1(counts.opposite() * 100.0 / others) : 0;
		return new Summary(counts.participants(), Math.max(0, counts.same() - 1), similarRate, oppositeRate,
				counts.different());
	}

	/**
	 * Average share of answers that every other guest has in common with mine, from how many
	 * guests picked option 1 per question. The counts include me, so I am taken out of each
	 * question.
	 * @param participants guests counted, including me
	 * @param oneCounts guests who picked option 1, by bit position
	 * @return % rounded to one decimal, or null when nobody else is counted
	 */
	static @Nullable Double averageMatch(long myBits, long participants, long[] oneCounts, int questionCount) {
		if (participants <= 1) {
			return null;
		}
		long matches = 0;
		for (int bit = 0; bit < questionCount; bit++) {
			long same = (((myBits >>> bit) & 1) == 1) ? oneCounts[bit] : participants - oneCounts[bit];
			matches += same - 1;
		}
		return round1(matches * 100.0 / (questionCount * (participants - 1)));
	}

	/**
	 * Per-question weights whose sum over a guest's option 1 picks orders guests the same
	 * way as their {@link #averageMatch}: the matches a guest has with everyone are
	 * {@code sum(participants - oneCounts)} plus {@code 2 * oneCounts - participants} for
	 * each option 1 pick, and the first part is the same for all.
	 */
	static long[] rarityWeights(long participants, long[] oneCounts, int questionCount) {
		long[] weights = new long[questionCount];
		for (int bit = 0; bit < questionCount; bit++) {
			weights[bit] = 2 * oneCounts[bit] - participants;
		}
		return weights;
	}

	/**
	 * Lower is rarer. Compares guests only against weights from the same counts.
	 */
	static long rarityScore(long bits, long[] weights) {
		long score = 0;
		for (int bit = 0; bit < weights.length; bit++) {
			if (((bits >>> bit) & 1) == 1) {
				score += weights[bit];
			}
		}
		return score;
	}

	/**
	 * Where I stand from the rarest guest, as "top n%".
	 * @param rarer guests with a lower {@link #rarityScore} than mine
	 * @param participants guests ranked, including me
	 * @return % rounded to one decimal, at least 0.1, or null when nobody else is ranked
	 */
	static @Nullable Double topPercent(long rarer, long participants) {
		if (participants <= 1) {
			return null;
		}
		return Math.max(0.1, round1((rarer + 1) * 100.0 / participants));
	}

	static int similarMaxDifferences(int questionCount) {
		return questionCount / 5;
	}

	static int oppositeMinDifferences(int questionCount) {
		return questionCount - questionCount / 5;
	}

	private static double round1(double value) {
		return Math.round(value * 10) / 10.0;
	}

	/**
	 * Participants by how far their answers are from mine, all including me.
	 * @param same participants with identical answers
	 * @param similar participants with at most {@link #similarMaxDifferences} differences
	 * @param opposite participants with at least {@link #oppositeMinDifferences} differences
	 * @param different participants with every answer the other way
	 */
	record Counts(long participants, long same, long similar, long opposite, long different) {
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
