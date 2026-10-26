package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.isitjustme.category.CombinationStatsRepository.StatsRow;
import com.isitjustme.category.RarityCalculator.Summary;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;

class RarityCalculatorTests {

	private static final GuestProfile WOMAN_20S = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);

	private static final GuestProfile MAN_30S = new GuestProfile(Gender.MALE, AgeGroup.THIRTIES);

	@Test
	void countsExactAndSimilarExcludingMe() {
		int mine = 0b0000000000;
		List<StatsRow> rows = List.of(
				new StatsRow(WOMAN_20S, mine, 3), // me + 2 identical
				new StatsRow(MAN_30S, mine, 1), // 1 identical in another group
				new StatsRow(WOMAN_20S, 0b0000000011, 4), // 2 differences: similar
				new StatsRow(MAN_30S, 0b0000000111, 2)); // 3 differences: not similar

		Summary summary = RarityCalculator.summarize(rows, mine);

		assertThat(summary.participants()).isEqualTo(10);
		assertThat(summary.exact()).isEqualTo(3);
		// (4 identical + 4 similar - me) / 9 others
		assertThat(summary.similar()).isEqualTo(77.8);
	}

	@Test
	void topCountsCombinationsAsRareAsMine() {
		List<StatsRow> rows = List.of(
				new StatsRow(WOMAN_20S, 1, 2), // mine: 2 people
				new StatsRow(WOMAN_20S, 2, 1), // rarer
				new StatsRow(WOMAN_20S, 3, 2), // as rare
				new StatsRow(WOMAN_20S, 4, 5)); // more common

		assertThat(RarityCalculator.summarize(rows, 1).top()).isEqualTo(50);
	}

	@Test
	void onlyParticipantIsUniqueButNotRare() {
		Summary summary = RarityCalculator.summarize(List.of(new StatsRow(WOMAN_20S, 5, 1)), 5);

		assertThat(summary).isEqualTo(new Summary(1, 0, 0, 100));
	}

}
