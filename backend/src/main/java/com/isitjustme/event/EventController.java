package com.isitjustme.event;

import java.time.Instant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.guest.Guest;
import com.isitjustme.guest.GuestController;
import com.isitjustme.guest.GuestService;

import lombok.RequiredArgsConstructor;

/**
 * Records one action of a visitor for the admin dashboard. Nothing a page shows depends
 * on it, so pages send it without waiting for the answer.
 */
@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
public class EventController {

	private final EventRepository eventRepository;

	private final GuestService guestService;

	private final CategoryStatsCache statsCache;

	@PostMapping
	public ResponseEntity<Void> record(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@Valid @RequestBody EventRequest request) {
		String category = request.category();
		if (category != null && statsCache.catalog().categories().stream().noneMatch((c) -> c.code().equals(category))) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown category");
		}
		// ad actions must say which ad and where; other actions carry neither
		boolean ad = request.type().isAd();
		if (ad && (request.ad() == null || request.placement() == null)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ad actions need ad and placement");
		}
		Long guestId = guestService.findByToken(token).map(Guest::getId).orElse(null);
		eventRepository.save(guestId, request.type(), category, ad ? request.ad() : null,
				ad ? request.placement() : null, Instant.now());
		return ResponseEntity.noContent().build();
	}

	/**
	 * @param category the category the action happened in, when it has one
	 * @param ad the ad of an ad action, as the site's ad list names it
	 * @param placement where that ad was shown
	 */
	public record EventRequest(@NotNull EventType type, @Nullable String category,
			@Nullable @Pattern(regexp = "[a-z0-9-]{1,30}") String ad, @Nullable AdPlacement placement) {
	}

}
