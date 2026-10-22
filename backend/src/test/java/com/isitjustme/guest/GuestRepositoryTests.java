package com.isitjustme.guest;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class GuestRepositoryTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	@Autowired
	private GuestRepository guestRepository;

	@Test
	void deletesOnlyGuestsLastSeenBeforeCutoff() {
		Instant now = Instant.now();
		guestRepository.save(new Guest("inactive", now.minus(Duration.ofDays(181))));
		guestRepository.save(new Guest("active", now.minus(Duration.ofDays(179))));

		int deleted = guestRepository.deleteByLastSeenAtBefore(now.minus(GuestService.RETENTION));

		assertThat(deleted).isEqualTo(1);
		assertThat(guestRepository.findByTokenHash("inactive")).isEmpty();
		assertThat(guestRepository.findByTokenHash("active")).isPresent();
	}

	@Test
	void storesProfile() {
		Guest guest = new Guest("with-profile", Instant.now());
		guest.updateProfile(new GuestProfile(Gender.FEMALE, AgeGroup.FIFTIES_PLUS));
		guestRepository.saveAndFlush(guest);

		assertThat(guestRepository.findByTokenHash("with-profile")).get()
			.extracting(Guest::profile)
			.isEqualTo(new GuestProfile(Gender.FEMALE, AgeGroup.FIFTIES_PLUS));
	}

}
