package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;

import com.isitjustme.category.CategoryStatsCache.StatsSnapshot;
import com.isitjustme.category.CombinationStatsRepository.StatsRow;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;

class StatsSnapshotTests {

	private static final GuestProfile WOMAN_20S = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);

	private static final GuestProfile MAN_30S = new GuestProfile(Gender.MALE, AgeGroup.THIRTIES);

	private static final Instant TAKEN_AT = Instant.parse("2026-11-01T00:00:00Z");

	private final StatsSnapshot snapshot = StatsSnapshot.of(TAKEN_AT,
			List.of(new StatsRow(WOMAN_20S, 5, 3), new StatsRow(MAN_30S, 5, 2)));

	@Test
	void keepsCountsThatAlreadyIncludeTheAnswer() {
		CategoryAnswer answer = new CategoryAnswer(1L, 1L, WOMAN_20S, 5, TAKEN_AT.minusSeconds(1));

		assertThat(snapshot.allWith(answer)[5]).isEqualTo(5);
		assertThat(snapshot.peersWith(answer)[5]).isEqualTo(3);
	}

	@Test
	void addsAnAnswerSavedAfterTheSnapshot() {
		CategoryAnswer answer = new CategoryAnswer(1L, 1L, WOMAN_20S, 7, TAKEN_AT.plusSeconds(1));

		assertThat(snapshot.allWith(answer)[7]).isEqualTo(1);
		assertThat(snapshot.allWith(answer)[5]).isEqualTo(5);
		assertThat(snapshot.peersWith(answer)[7]).isEqualTo(1);
	}

	@Test
	void addsAnAnswerMovedToANewProfileAfterTheSnapshot() {
		CategoryAnswer answer = new CategoryAnswer(1L, 1L, WOMAN_20S, 5, TAKEN_AT.minusSeconds(1));
		answer.changeProfile(MAN_30S, TAKEN_AT.plusSeconds(1));

		assertThat(snapshot.peersWith(answer)[5]).isEqualTo(3);
	}

	@Test
	void readsBackFromJson() {
		var serializer = new JacksonJsonRedisSerializer<>(StatsSnapshot.class);

		StatsSnapshot read = serializer.deserialize(serializer.serialize(snapshot));

		assertThat(read).usingRecursiveComparison().isEqualTo(snapshot);
	}

	@Test
	void rejectsAValueCachedAsRows() {
		var serializer = new JacksonJsonRedisSerializer<>(StatsSnapshot.class);
		byte[] old = """
				{"takenAt":"2026-11-01T00:00:00Z","rows":[{"profile":{"gender":"FEMALE","ageGroup":"TWENTIES"},"answerBits":5,"count":3}]}
				""".getBytes(StandardCharsets.UTF_8);

		assertThatThrownBy(() -> serializer.deserialize(old)).isInstanceOf(RuntimeException.class);
	}

}
