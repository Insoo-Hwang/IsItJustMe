package com.isitjustme.config;

import java.time.Duration;
import java.util.Map;

import org.jspecify.annotations.Nullable;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

import com.isitjustme.category.CategoryCatalog;
import com.isitjustme.category.CategoryStatsCache.Option0Rates;
import com.isitjustme.category.CategoryStatsCache.OverallBitStats;
import com.isitjustme.category.CategoryStatsCache.ParticipantCounts;
import com.isitjustme.category.CategoryStatsCache.QuestionGroupCounts;
import com.isitjustme.category.CategoryStatsCache.StatsSnapshot;
import com.isitjustme.room.RoomCards.RoomCard;

import lombok.extern.slf4j.Slf4j;

/**
 * Redis caches for data every guest sees the same way. Each cache stores one record type
 * as plain JSON, so no class names end up in Redis.
 */
@Slf4j
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {

	public static final String CATEGORIES = "categories";

	public static final String PARTICIPANTS = "participants";

	public static final String OPTION0_RATES = "option0-rates";

	public static final String COMBINATION_STATS = "combination-stats";

	public static final String QUESTION_STATS = "question-stats";

	public static final String ROOMS = "rooms";

	public static final String OVERALL_BIT_STATS = "overall-bit-stats";

	/** Cache name → stored type and TTL (null = never expires). */
	static final Map<String, Entry> CACHES = Map.of(
			CATEGORIES, new Entry(CategoryCatalog.class, null),
			PARTICIPANTS, new Entry(ParticipantCounts.class, Duration.ofMinutes(5)),
			OPTION0_RATES, new Entry(Option0Rates.class, Duration.ofMinutes(30)),
			COMBINATION_STATS, new Entry(StatsSnapshot.class, Duration.ofHours(1)),
			QUESTION_STATS, new Entry(QuestionGroupCounts.class, Duration.ofHours(1)),
			ROOMS, new Entry(RoomCard.class, Duration.ofMinutes(30)),
			OVERALL_BIT_STATS, new Entry(OverallBitStats.class, Duration.ofMinutes(30)));

	@Bean
	RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
		// Writes go out before the method returns (the default sends them in the background),
		// so a value is readable right after it is stored and write failures reach the error handler.
		RedisCacheWriter writer = RedisCacheWriter.create(connectionFactory, (c) -> c.immediateWrites());
		RedisCacheManager.RedisCacheManagerBuilder builder = RedisCacheManager.builder(writer)
			.disableCreateOnMissingCache();
		CACHES.forEach((name, entry) -> builder.withCacheConfiguration(name, configuration(entry)));
		return builder.build();
	}

	static RedisCacheConfiguration configuration(Entry entry) {
		RedisCacheConfiguration configuration = RedisCacheConfiguration.defaultCacheConfig()
			.disableCachingNullValues()
			.serializeValuesWith(SerializationPair.fromSerializer(new JacksonJsonRedisSerializer<>(entry.type())));
		return (entry.ttl() != null) ? configuration.entryTtl(entry.ttl()) : configuration;
	}

	/**
	 * A cache failure (Redis down, or a value stored by an older version) falls back to
	 * the database instead of failing the request.
	 */
	@Override
	public CacheErrorHandler errorHandler() {
		return new CacheErrorHandler() {

			@Override
			public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
				log.warn("Cache get failed: {}::{}", cache.getName(), key, ex);
				// drops a value that no longer reads, so the next request stores a fresh one
				try {
					cache.evict(key);
				}
				catch (RuntimeException evictFailure) {
					// Redis is down; the request goes on without the cache
				}
			}

			@Override
			public void handleCachePutError(RuntimeException ex, Cache cache, Object key, @Nullable Object value) {
				log.warn("Cache put failed: {}::{}", cache.getName(), key, ex);
			}

			@Override
			public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
				log.warn("Cache evict failed: {}::{}", cache.getName(), key, ex);
			}

			@Override
			public void handleCacheClearError(RuntimeException ex, Cache cache) {
				log.warn("Cache clear failed: {}", cache.getName(), ex);
			}

		};
	}

	record Entry(Class<?> type, @Nullable Duration ttl) {
	}

}
