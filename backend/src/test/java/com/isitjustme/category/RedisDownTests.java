package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.isitjustme.config.CacheConfig;

/**
 * With nothing listening on the Redis port, cached reads still come from the database.
 */
@DataJpaTest(properties = { "spring.data.redis.port=1", "spring.data.redis.timeout=500ms",
		"spring.data.redis.connect-timeout=500ms" })
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ImportAutoConfiguration(DataRedisAutoConfiguration.class)
@Import({ CacheConfig.class, CategoryStatsCache.class, CombinationStatsRepository.class,
		OverallAnswerRepository.class })
class RedisDownTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	@Autowired
	private CategoryStatsCache statsCache;

	@Test
	void readsTheDatabaseWhenRedisIsDown() {
		Instant start = Instant.now();

		assertThat(statsCache.catalog().categories()).hasSize(6);
		assertThat(statsCache.participants().byCategory()).containsEntry("food", 0L);
		assertThat(statsCache.overallBitStats().participants()).isZero();
		assertThat(statsCache.overallRanks().participants()).isZero();

		assertThat(Duration.between(start, Instant.now())).isLessThan(Duration.ofSeconds(5));
	}

}
