package com.isitjustme.mvp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.category.CategoryStatsCache.OverallBitStats;

@DataJpaTest(properties = "site.mvp-goal=3")
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ MvpMode.class, NotifyEmailRepository.class })
class MvpModeTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	@Autowired
	private MvpMode mvp;

	@Autowired
	private NotifyEmailRepository emailRepository;

	@Autowired
	private JdbcClient jdbcClient;

	@MockitoBean
	private CategoryStatsCache statsCache;

	private void completers(long count) {
		given(statsCache.overallBitStats()).willReturn(new OverallBitStats(Instant.now(), count, new long[60]));
	}

	@Test
	void startsLockedAndOpensAtTheGoal() {
		completers(2);
		assertThat(mvp.state()).isEqualTo(new MvpMode.State(true, true, 3, 2));

		completers(3);
		assertThat(mvp.locked()).isFalse();
		assertThat(mvp.state().enabled()).isTrue();
	}

	@Test
	void theAdminSwitchIsStored() {
		completers(0);

		assertThat(mvp.set(false)).isEqualTo(new MvpMode.State(false, false, 3, 0));
		assertThat(jdbcClient.sql("SELECT value FROM site_setting WHERE name = 'mvp_enabled'")
			.query(String.class)
			.single()).isEqualTo("false");

		assertThat(mvp.set(true).locked()).isTrue();
	}

	@Test
	void keepsOneAddressPerGuest() {
		long first = guest();
		long second = guest();
		emailRepository.save(first, "old@example.com", Instant.parse("2026-11-01T00:00:00Z"));
		emailRepository.save(first, "new@example.com", Instant.parse("2026-11-02T00:00:00Z"));
		emailRepository.save(second, "new@example.com", Instant.parse("2026-11-03T00:00:00Z"));

		assertThat(emailRepository.count()).isEqualTo(2);
		assertThat(emailRepository.findAll()).extracting(NotifyEmailRepository.NotifyEmail::email)
			.containsExactly("new@example.com");
	}

	private long guest() {
		return jdbcClient.sql("""
				INSERT INTO guest (token_hash, created_at) VALUES (:hash, now()) RETURNING id
				""").param("hash", "hash-" + System.nanoTime()).query(Long.class).single();
	}

}
