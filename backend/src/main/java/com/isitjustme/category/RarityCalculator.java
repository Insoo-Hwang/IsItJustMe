package com.isitjustme.category;

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
