package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import com.isitjustme.category.RarityCalculator.Summary;

class RarityCalculatorTests {

	@Test
	void countsExactAndSimilarExcludingMe() {
		int mine = 0b0000000000;
		long[] counts = counts(Map.of(
				mine, 4L, // me + 3 identical
				0b0000000011, 4L, // 2 differences: similar
				0b0000000111, 2L)); // 3 differences: not similar

		Summary summary = RarityCalculator.summarize(counts, mine);

		assertThat(summary.participants()).isEqualTo(10);
		assertThat(summary.exact()).isEqualTo(3);
		// (4 identical + 4 similar - me) / 9 others
		assertThat(summary.similar()).isEqualTo(77.8);
	}

	@Test
	void countsOppositeAndDifferent() {
		int mine = 0b0000000000;
		long[] counts = counts(Map.of(
				mine, 1L, // me
				0b1111111111, 2L, // 0 matches: opposite and different
				0b0011111111, 1L, // 2 matches: opposite
				0b0001111111, 1L)); // 3 matches: neither

		Summary summary = RarityCalculator.summarize(counts, mine);

		// 3 opposite / 4 others
		assertThat(summary.opposite()).isEqualTo(75.0);
		assertThat(summary.different()).isEqualTo(2);
	}

	@Test
	void scalesThresholdsWithQuestionCount() {
		assertThat(RarityCalculator.similarMaxDifferences(10)).isEqualTo(2);
		assertThat(RarityCalculator.oppositeMinDifferences(10)).isEqualTo(8);
		assertThat(RarityCalculator.similarMaxDifferences(60)).isEqualTo(12);
		assertThat(RarityCalculator.oppositeMinDifferences(60)).isEqualTo(48);
	}

	@Test
	void onlyParticipantHasNobodyToCompare() {
		Summary summary = RarityCalculator.summarize(counts(Map.of(5, 1L)), 5);

		assertThat(summary).isEqualTo(new Summary(1, 0, 0, 0, 0));
	}

	private static long[] counts(Map<Integer, Long> byBits) {
		long[] counts = new long[RarityCalculator.COMBINATIONS];
		byBits.forEach((bits, count) -> counts[bits] = count);
		return counts;
	}

}
