package com.isitjustme.site;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Counts requests per key in fixed windows, in this server's memory. Enough for one
 * server; several servers would each count on their own (Redis would share the counts).
 * Made by {@link RateLimitGuard}.
 */
public class RateLimiter {

	/** Above this many keys, windows that already ended are dropped. */
	private static final int SWEEP_ABOVE = 10_000;

	private final Clock clock;

	private final Map<String, Window> windows = new ConcurrentHashMap<>();

	public RateLimiter(Clock clock) {
		this.clock = clock;
	}

	/**
	 * Counts one request for {@code key} and says whether it is still within
	 * {@code limit} requests per {@code window}.
	 */
	public boolean tryAcquire(String key, int limit, Duration window) {
		long now = clock.millis();
		if (windows.size() > SWEEP_ABOVE) {
			windows.values().removeIf((w) -> w.endsAt <= now);
		}
		Window current = windows.compute(key,
				(k, w) -> (w == null || w.endsAt <= now) ? new Window(now + window.toMillis(), 1) : w.next());
		return current.count <= limit;
	}

	/** Whether {@code key} already used up {@code limit}, without counting a request. */
	public boolean exhausted(String key, int limit) {
		Window w = windows.get(key);
		return w != null && w.endsAt > clock.millis() && w.count >= limit;
	}

	private record Window(long endsAt, int count) {

		Window next() {
			return new Window(endsAt, count + 1);
		}

	}

}
