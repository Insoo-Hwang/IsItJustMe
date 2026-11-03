package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.isitjustme.category.CategoryStatsCache.OverallBitStats;

/**
 * The {@code overall_stats} row follows every write to {@code overall_answer}, and the
 * average match from it equals comparing with every guest directly.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(OverallAnswerRepository.class)
class OverallStatsTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	private static final long ALL = (1L << 60) - 1;

	@Autowired
	private OverallAnswerRepository overallRepository;

	@Autowired
	private JdbcClient jdbcClient;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@Test
	void countsANewGuest() {
		OverallBitStats before = overallRepository.bitStats();

		overallRepository.save(guest(), 0b101);

		OverallBitStats after = overallRepository.bitStats();
		assertThat(after.participants()).isEqualTo(before.participants() + 1);
		assertThat(after.oneCounts()[0]).isEqualTo(before.oneCounts()[0] + 1);
		assertThat(after.oneCounts()[1]).isEqualTo(before.oneCounts()[1]);
		assertThat(after.oneCounts()[2]).isEqualTo(before.oneCounts()[2] + 1);
		assertMatchesRecount();
	}

	@Test
	void movesAChangedAnswer() {
		long guestId = guest();
		overallRepository.save(guestId, 0b011);
		OverallBitStats before = overallRepository.bitStats();

		overallRepository.save(guestId, 0b110);

		OverallBitStats after = overallRepository.bitStats();
		assertThat(after.participants()).isEqualTo(before.participants());
		assertThat(after.oneCounts()[0]).isEqualTo(before.oneCounts()[0] - 1);
		assertThat(after.oneCounts()[1]).isEqualTo(before.oneCounts()[1]);
		assertThat(after.oneCounts()[2]).isEqualTo(before.oneCounts()[2] + 1);
		assertMatchesRecount();
	}

	@Test
	void dropsADeletedAnswerAndADeletedGuest() {
		long kept = guest();
		long answerDeleted = guest();
		long guestDeleted = guest();
		overallRepository.save(kept, ALL);
		overallRepository.save(answerDeleted, ALL);
		overallRepository.save(guestDeleted, ALL);
		OverallBitStats before = overallRepository.bitStats();

		jdbcClient.sql("DELETE FROM overall_answer WHERE guest_id = ?").param(answerDeleted).update();
		// overall_answer goes with the guest through ON DELETE CASCADE
		jdbcClient.sql("DELETE FROM guest WHERE id = ?").param(guestDeleted).update();

		OverallBitStats after = overallRepository.bitStats();
		assertThat(after.participants()).isEqualTo(before.participants() - 2);
		assertThat(Arrays.stream(after.oneCounts()).min().orElseThrow()).isNotNegative();
		assertThat(after.oneCounts()[59]).isEqualTo(before.oneCounts()[59] - 2);
		assertMatchesRecount();
	}

	@Test
	void averageMatchEqualsXorWithEveryGuest() {
		Random random = new Random(7);
		List<Long> guests = new ArrayList<>();
		for (int i = 0; i < 80; i++) {
			long guestId = guest();
			overallRepository.save(guestId, random.nextLong() & ALL);
			guests.add(guestId);
		}
		overallRepository.save(guests.get(1), 0L);
		overallRepository.save(guests.get(2), ALL);
		OverallBitStats stats = overallRepository.bitStats();

		for (long me : guests.subList(0, 10)) {
			long myBits = overallRepository.findBits(me).orElseThrow();
			double direct = jdbcClient.sql("""
					SELECT AVG(60 - BIT_COUNT((overall_bits # :myBits)::BIT(64))) * 100 / 60
					FROM overall_answer WHERE guest_id <> :me
					""").param("myBits", myBits).param("me", me).query(Double.class).single();

			assertThat(RarityCalculator.averageMatch(myBits, stats.participants(), stats.oneCounts(), 60))
				.isCloseTo(direct, within(0.05));
		}
	}

	@Test
	void rebuildCountsExistingAnswers() {
		overallRepository.save(guest(), 0b1001);
		overallRepository.save(guest(), ALL);
		// as if the answers were saved before the counts existed
		jdbcClient.sql("UPDATE overall_stats SET participants = 0, one_counts = array_fill(0::BIGINT, ARRAY[60])")
			.update();

		jdbcClient.sql("SELECT overall_stats_rebuild()").query((rs) -> {
		});

		assertMatchesRecount();
		assertThat(overallRepository.bitStats().participants()).isPositive();
	}

	@Test
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	void concurrentWritesLoseNothing() throws Exception {
		List<Long> guests = new ArrayList<>();
		for (int i = 0; i < 40; i++) {
			guests.add(transactionTemplate.execute((status) -> guest()));
		}
		ExecutorService pool = Executors.newFixedThreadPool(8);
		try {
			List<Callable<Void>> writes = new ArrayList<>();
			for (int round = 0; round < 3; round++) {
				for (int i = 0; i < guests.size(); i++) {
					long guestId = guests.get(i);
					long bits = new Random(round * 100L + i).nextLong() & ALL;
					writes.add(() -> {
						transactionTemplate.executeWithoutResult((status) -> overallRepository.save(guestId, bits));
						return null;
					});
				}
			}
			for (Future<Void> write : pool.invokeAll(writes)) {
				write.get();
			}
		}
		finally {
			pool.shutdown();
		}

		assertMatchesRecount();

		transactionTemplate.executeWithoutResult((status) -> guests
			.forEach((id) -> jdbcClient.sql("DELETE FROM guest WHERE id = ?").param(id).update()));
		assertMatchesRecount();
	}

	private long guest() {
		return jdbcClient.sql("""
				INSERT INTO guest (token_hash, created_at) VALUES (gen_random_uuid()::TEXT, now()) RETURNING id
				""").query(Long.class).single();
	}

	private void assertMatchesRecount() {
		OverallBitStats stats = overallRepository.bitStats();
		long participants = jdbcClient.sql("SELECT COUNT(*) FROM overall_answer").query(Long.class).single();
		List<Long> recount = jdbcClient.sql("""
				SELECT COUNT(o.guest_id) FILTER (WHERE (o.overall_bits >> b) & 1 = 1)
				FROM generate_series(0, 59) AS b LEFT JOIN overall_answer o ON true
				GROUP BY b ORDER BY b
				""").query(Long.class).list();

		assertThat(stats.participants()).isEqualTo(participants);
		assertThat(stats.oneCounts()).containsExactly(recount.stream().mapToLong(Long::longValue).toArray());
	}

}
