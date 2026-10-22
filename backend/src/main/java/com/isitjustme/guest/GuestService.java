package com.isitjustme.guest;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GuestService {

	/**
	 * Guests who haven't visited for this long are deleted, and the cookie expires
	 * after the same period.
	 */
	static final Duration RETENTION = Duration.ofDays(180);

	private final GuestRepository guestRepository;

	/**
	 * Returns the guest for a valid token, or issues a new guest and token when the
	 * token is missing or unknown.
	 */
	@Transactional
	public GuestSession resolveOrIssue(@Nullable String rawToken) {
		Instant now = Instant.now();
		if (rawToken != null && !rawToken.isBlank()) {
			Optional<Guest> found = guestRepository.findByTokenHash(GuestTokens.hash(rawToken));
			if (found.isPresent()) {
				found.get().touch(now);
				return new GuestSession(rawToken, false, found.get().profile());
			}
		}
		String token = GuestTokens.generate();
		guestRepository.save(new Guest(GuestTokens.hash(token), now));
		return new GuestSession(token, true, null);
	}

	/**
	 * Saves the profile for the guest owning the token. Returns false for an unknown token.
	 */
	@Transactional
	public boolean updateProfile(@Nullable String rawToken, GuestProfile profile) {
		if (rawToken == null || rawToken.isBlank()) {
			return false;
		}
		Optional<Guest> found = guestRepository.findByTokenHash(GuestTokens.hash(rawToken));
		found.ifPresent((guest) -> guest.updateProfile(profile));
		return found.isPresent();
	}

	/**
	 * Deletes guests whose last visit is older than {@link #RETENTION}. Data owned by a
	 * guest is removed with it through {@code ON DELETE CASCADE} foreign keys.
	 */
	@Transactional
	public int deleteInactive() {
		return guestRepository.deleteByLastSeenAtBefore(Instant.now().minus(RETENTION));
	}

	public record GuestSession(String token, boolean issued, @Nullable GuestProfile profile) {
	}

}
