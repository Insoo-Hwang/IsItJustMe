package com.isitjustme.mvp;

import java.time.Instant;
import java.util.Locale;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.guest.Guest;
import com.isitjustme.guest.GuestController;
import com.isitjustme.guest.GuestService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/mvp")
@RequiredArgsConstructor
public class MvpController {

	private final MvpMode mvp;

	private final NotifyEmailRepository emailRepository;

	private final GuestService guestService;

	/** Whether the overall numbers are hidden, and how far the count is from opening them. */
	@GetMapping
	public StatusView status() {
		MvpMode.State state = mvp.state();
		return new StatusView(state.locked(), state.goal(), state.completers());
	}

	/** Leaves an address to hear when the numbers open. */
	@PutMapping("/email")
	public ResponseEntity<Void> saveEmail(
			@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@Valid @RequestBody EmailRequest request) {
		Guest guest = guestService.findByToken(token)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		emailRepository.save(guest.getId(), request.email().strip().toLowerCase(Locale.ROOT), Instant.now());
		return ResponseEntity.noContent().build();
	}

	public record StatusView(boolean locked, int goal, long completers) {
	}

	public record EmailRequest(@NotBlank @Email(regexp = ".+@.+\\..+") @Size(max = 254) String email) {
	}

}
