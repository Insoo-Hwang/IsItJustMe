package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.Map;
import java.util.Random;

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

	@Test
	void averageMatchNeedsSomeoneElse() {
		assertThat(RarityCalculator.averageMatch(5L, 1, oneCounts(5L), 60)).isNull();
		assertThat(RarityCalculator.averageMatch(5L, 0, new long[60], 60)).isNull();
	}

	@Test
	void averageMatchWithOneOtherGuest() {
		long mine = 0L;
		long other = (1L << 15) - 1; // 15 of 60 differ

		assertThat(RarityCalculator.averageMatch(mine, 2, oneCounts(mine, other), 60)).isEqualTo(75.0);
	}

	@Test
	void averageMatchOfIdenticalAndOppositeGuests() {
		long all = (1L << 60) - 1;

		assertThat(RarityCalculator.averageMatch(0L, 3, oneCounts(0L, 0L, 0L), 60)).isEqualTo(100.0);
		assertThat(RarityCalculator.averageMatch(all, 3, oneCounts(all, all, all), 60)).isEqualTo(100.0);
		assertThat(RarityCalculator.averageMatch(0L, 3, oneCounts(0L, all, all), 60)).isEqualTo(0.0);
		assertThat(RarityCalculator.averageMatch(all, 3, oneCounts(all, 0L, 0L), 60)).isEqualTo(0.0);
	}

	@Test
	void averageMatchEqualsComparingWithEveryoneDirectly() {
		Random random = new Random(42);
		long[] guests = new long[500];
		for (int i = 0; i < guests.length; i++) {
			// skewed picks, so questions differ in how common each answer is
			for (int bit = 0; bit < 60; bit++) {
				if (random.nextDouble() < 0.15 + bit / 80.0) {
					guests[i] |= 1L << bit;
				}
			}
		}
		long[] counts = oneCounts(guests);

		for (int me = 0; me < 20; me++) {
			long matches = 0;
			for (int other = 0; other < guests.length; other++) {
				if (other != me) {
					matches += 60 - Long.bitCount(guests[me] ^ guests[other]);
				}
			}
			double direct = matches * 100.0 / (60.0 * (guests.length - 1));

			assertThat(RarityCalculator.averageMatch(guests[me], guests.length, counts, 60)).isCloseTo(direct,
					within(0.05));
		}
	}

	private static long[] oneCounts(long... guests) {
		long[] counts = new long[60];
		for (long bits : guests) {
			for (int bit = 0; bit < 60; bit++) {
				counts[bit] += (bits >>> bit) & 1;
			}
		}
		return counts;
	}

	private static long[] counts(Map<Integer, Long> byBits) {
		long[] counts = new long[RarityCalculator.COMBINATIONS];
		byBits.forEach((bits, count) -> counts[bits] = count);
		return counts;
	}

}
