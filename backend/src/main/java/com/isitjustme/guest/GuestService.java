package com.isitjustme.guest;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GuestService {

	/**
	 * The cookie expires after this long without a visit. Guests themselves are kept
	 * forever so their answers keep counting in the stats.
	 */
	static final Duration COOKIE_MAX_AGE = Duration.ofDays(180);

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
	 * Finds the guest owning the token and locks its row until the current transaction
	 * ends, so one guest's submissions are applied one at a time.
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public Optional<Guest> lockByToken(@Nullable String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return Optional.empty();
		}
		return guestRepository.findByTokenHashForUpdate(GuestTokens.hash(rawToken));
	}

	/**
	 * Finds the guest owning the token without locking it.
	 */
	@Transactional(readOnly = true)
	public Optional<Guest> findByToken(@Nullable String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return Optional.empty();
		}
		return guestRepository.findByTokenHash(GuestTokens.hash(rawToken));
	}

	public record GuestSession(String token, boolean issued, @Nullable GuestProfile profile) {
	}

}
