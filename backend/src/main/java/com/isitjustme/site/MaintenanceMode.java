package com.isitjustme.site;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import org.jspecify.annotations.Nullable;

/**
 * Whether the site is closed for maintenance. It starts from {@code site.maintenance} (the
 * MAINTENANCE environment variable) and the admin page can switch it while running. The
 * switch lives in this server's memory: a restart goes back to the property. Made by
 * {@link MaintenanceGuard}.
 */
public class MaintenanceMode {

	public static final String DEFAULT_MESSAGE = "더 나은 서비스를 위해 잠시 점검하고 있어요. 조금 뒤에 다시 와주세요.";

	private final AtomicReference<State> state;

	public MaintenanceMode(boolean enabled) {
		this.state = new AtomicReference<>(new State(enabled, DEFAULT_MESSAGE, enabled ? Instant.now() : null));
	}

	public State state() {
		return state.get();
	}

	/**
	 * @param message shown to visitors; the default when blank
	 */
	public State set(boolean enabled, @Nullable String message) {
		String text = message == null || message.isBlank() ? DEFAULT_MESSAGE : message.strip();
		return state.updateAndGet((old) -> new State(enabled, text,
				enabled ? (old.enabled() && old.since() != null ? old.since() : Instant.now()) : null));
	}

	/**
	 * @param since when maintenance started; empty while the site is open
	 */
	public record State(boolean enabled, String message, @Nullable Instant since) {
	}

}
