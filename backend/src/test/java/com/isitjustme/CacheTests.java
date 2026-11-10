package com.isitjustme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;

import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestService;
import com.isitjustme.room.RoomCards;
import com.isitjustme.room.RoomService;

/**
 * Every cached value is stored in Redis with its TTL and reads back the same.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class CacheTests {

	private static final List<String> CATEGORY_CODES = List.of("food", "love", "life", "travel", "spending", "people");

	@Autowired
	private CategoryStatsCache statsCache;

	@Autowired
	private RoomCards roomCards;

	@Autowired
	private CategoryService categoryService;

	@Autowired
	private RoomService roomService;

	@Autowired
	private GuestService guestService;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private StringRedisTemplate redis;

	@Autowired
	private JdbcClient jdbcClient;

	@BeforeEach
	void clearCaches() {
		cacheManager.getCacheNames().forEach((name) -> cacheManager.getCache(name).invalidate());
	}

	@Test
	void cachedValuesReadBackFromRedis() {
		String owner = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(owner, new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES));
		CATEGORY_CODES.forEach((code) -> categoryService.submit(owner, code, 0b101));
		String shareToken = roomService.open(owner, "철수");
		long categoryId = statsCache.catalog().categories().getFirst().id();

		// the second call of each pair reads from Redis
		assertThat(statsCache.catalog()).isEqualTo(statsCache.catalog());
		assertThat(statsCache.participants()).isEqualTo(statsCache.participants());
		assertThat(statsCache.option0Rates()).isEqualTo(statsCache.option0Rates());
		assertThat(statsCache.stats(categoryId)).usingRecursiveComparison().isEqualTo(statsCache.stats(categoryId));
		assertThat(statsCache.stats(categoryId).groups()).isNotEmpty();
		assertThat(statsCache.questionStats(categoryId)).isEqualTo(statsCache.questionStats(categoryId));
		assertThat(statsCache.questionStats(categoryId).byQuestion()).isNotEmpty();
		assertThat(roomCards.find(shareToken)).isEqualTo(roomCards.find(shareToken));
		assertThat(statsCache.overallBitStats()).usingRecursiveComparison().isEqualTo(statsCache.overallBitStats());
		assertThat(statsCache.overallRanks()).usingRecursiveComparison().isEqualTo(statsCache.overallRanks());
		assertThat(statsCache.overallRanks().scores()).isNotEmpty();

		assertThat(ttlOf("categories")).isEqualTo(-1);
		assertThat(ttlOf("participants")).isBetween(1L, 5 * 60L);
		assertThat(ttlOf("option0-rates")).isBetween(1L, 30 * 60L);
		assertThat(ttlOf("combination-stats")).isBetween(1L, 60 * 60L);
		assertThat(ttlOf("question-stats")).isBetween(1L, 60 * 60L);
		assertThat(ttlOf("rooms")).isBetween(1L, 30 * 60L);
		assertThat(ttlOf("overall-bit-stats")).isBetween(1L, 30 * 60L);
		assertThat(ttlOf("overall-ranks")).isBetween(1L, 30 * 60L);
	}

	@Test
	void averageMatchCountsAnAnswerTheCachedCountsMiss() {
		completedGuest(0b0);
		// cached before the next guest answers
		long cachedParticipants = statsCache.overallBitStats().participants();

		String me = completedGuest(0b1111111111);

		assertThat(statsCache.overallBitStats().participants()).isEqualTo(cachedParticipants);
		assertThat(categoryService.overallResult(me).averageMatch()).isCloseTo(directAverageMatch(me), within(0.05));
	}

	// every other guest compared one by one
	private double directAverageMatch(String token) {
		return jdbcClient.sql("""
				SELECT AVG(60 - BIT_COUNT((o.overall_bits # m.overall_bits)::BIT(64))) * 100 / 60
				FROM overall_answer o
				JOIN overall_answer m ON m.guest_id = :me
				WHERE o.guest_id <> m.guest_id
				""").param("me", guestService.findByToken(token).orElseThrow().getId()).query(Double.class).single();
	}

	private String completedGuest(int bits) {
		String token = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(token, new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES));
		CATEGORY_CODES.forEach((code) -> categoryService.submit(token, code, bits));
		return token;
	}

	@Test
	void renamingARoomDropsItsCard() {
		String owner = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(owner, new GuestProfile(Gender.MALE, AgeGroup.THIRTIES));
		CATEGORY_CODES.forEach((code) -> categoryService.submit(owner, code, 0));
		String shareToken = roomService.open(owner, "철수");
		assertThat(roomCards.find(shareToken).ownerName()).isEqualTo("철수");

		roomService.open(owner, "영희");

		assertThat(roomCards.find(shareToken).ownerName()).isEqualTo("영희");
	}

	private long ttlOf(String cacheName) {
		String key = redis.keys(cacheName + "::*").iterator().next();
		return redis.getExpire(key);
	}

}
