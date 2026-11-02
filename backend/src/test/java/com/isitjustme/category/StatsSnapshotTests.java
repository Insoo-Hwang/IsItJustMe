package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.isitjustme.category.CategoryStatsCache.StatsSnapshot;
import com.isitjustme.category.CombinationStatsRepository.StatsRow;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;

class StatsSnapshotTests {

	private static final GuestProfile WOMAN_20S = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);

	private static final Instant TAKEN_AT = Instant.parse("2026-11-01T00:00:00Z");

	private final StatsSnapshot snapshot = new StatsSnapshot(TAKEN_AT, List.of(new StatsRow(WOMAN_20S, 5, 3)));

	@Test
	void keepsRowsThatAlreadyCountTheAnswer() {
		CategoryAnswer answer = new CategoryAnswer(1L, 1L, WOMAN_20S, 5, TAKEN_AT.minusSeconds(1));

		assertThat(snapshot.rowsWith(answer)).isEqualTo(snapshot.rows());
	}

	@Test
	void addsAnAnswerSavedAfterTheSnapshot() {
		CategoryAnswer answer = new CategoryAnswer(1L, 1L, WOMAN_20S, 7, TAKEN_AT.plusSeconds(1));

		assertThat(snapshot.rowsWith(answer)).containsExactly(new StatsRow(WOMAN_20S, 5, 3),
				new StatsRow(WOMAN_20S, 7, 1));
	}

	@Test
	void addsAnAnswerMovedToANewProfileAfterTheSnapshot() {
		GuestProfile man30s = new GuestProfile(Gender.MALE, AgeGroup.THIRTIES);
		CategoryAnswer answer = new CategoryAnswer(1L, 1L, WOMAN_20S, 5, TAKEN_AT.minusSeconds(1));
		answer.changeProfile(man30s, TAKEN_AT.plusSeconds(1));

		assertThat(snapshot.rowsWith(answer)).contains(new StatsRow(man30s, 5, 1));
	}

}
