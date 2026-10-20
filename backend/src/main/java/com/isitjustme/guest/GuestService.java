package com.isitjustme.guest;

import java.time.Instant;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GuestService {

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
				return new GuestSession(rawToken, false);
			}
		}
		String token = GuestTokens.generate();
		guestRepository.save(new Guest(GuestTokens.hash(token), now));
		return new GuestSession(token, true);
	}

	public record GuestSession(String token, boolean issued) {
	}

}
