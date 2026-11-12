package com.isitjustme.site;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class RateLimiterTests {

	private Instant now = Instant.parse("2026-11-13T00:00:00Z");

	private final Clock clock = new Clock() {
		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}

		@Override
		public Instant instant() {
			return now;
		}
	};

	@Test
	void allowsTheLimitPerWindowThenStartsOver() {
		RateLimiter limiter = new RateLimiter(clock);
		Duration minute = Duration.ofMinutes(1);

		for (int i = 0; i < 3; i++) {
			assertThat(limiter.tryAcquire("a", 3, minute)).isTrue();
		}
		assertThat(limiter.tryAcquire("a", 3, minute)).isFalse();
		// other keys count on their own
		assertThat(limiter.tryAcquire("b", 3, minute)).isTrue();

		now = now.plus(minute);
		assertThat(limiter.tryAcquire("a", 3, minute)).isTrue();
	}

	@Test
	void exhaustedDoesNotCount() {
		RateLimiter limiter = new RateLimiter(clock);

		assertThat(limiter.exhausted("a", 2)).isFalse();
		limiter.tryAcquire("a", 2, Duration.ofMinutes(1));
		assertThat(limiter.exhausted("a", 2)).isFalse();
		limiter.tryAcquire("a", 2, Duration.ofMinutes(1));
		assertThat(limiter.exhausted("a", 2)).isTrue();
	}

}
