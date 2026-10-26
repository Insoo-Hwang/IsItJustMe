package com.isitjustme.guest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.isitjustme.guest.GuestService.GuestSession;

@RestController
@RequestMapping("/api/v1/guests")
public class GuestController {

	public static final String COOKIE_NAME = "guest_token";

	private final GuestService guestService;

	private final boolean secureCookie;

	public GuestController(GuestService guestService, @Value("${app.guest.cookie-secure:true}") boolean secureCookie) {
		this.guestService = guestService;
		this.secureCookie = secureCookie;
	}

	/**
	 * Issues a guest token cookie on first visit, or validates the existing one.
	 * The cookie is re-sent every time so its expiry slides forward on each visit.
	 */
	@PostMapping("/session")
	public ResponseEntity<SessionResponse> session(@CookieValue(name = COOKIE_NAME, required = false) String token) {
		GuestSession session = guestService.resolveOrIssue(token);
		ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, session.token())
			.httpOnly(true)
			.secure(secureCookie)
			.sameSite("Lax")
			.path("/")
			.maxAge(GuestService.COOKIE_MAX_AGE)
			.build();
		return ResponseEntity.status(session.issued() ? HttpStatus.CREATED : HttpStatus.OK)
			.header(HttpHeaders.SET_COOKIE, cookie.toString())
			.body(new SessionResponse(session.issued(), session.profile()));
	}

	/**
	 * Saves the guest's gender and age group. Requires a token issued by {@link #session}.
	 */
	@PutMapping("/profile")
	public ResponseEntity<Void> updateProfile(@CookieValue(name = COOKIE_NAME, required = false) String token,
			@Valid @RequestBody ProfileRequest request) {
		boolean updated = guestService.updateProfile(token, new GuestProfile(request.gender(), request.ageGroup()));
		return updated ? ResponseEntity.noContent().build() : ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
	}

	public record SessionResponse(boolean issued, @Nullable GuestProfile profile) {
	}

	public record ProfileRequest(@NotNull Gender gender, @NotNull AgeGroup ageGroup) {
	}

}
