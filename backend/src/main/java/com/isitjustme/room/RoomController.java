package com.isitjustme.room;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.isitjustme.guest.GuestController;
import com.isitjustme.room.RoomService.ComparisonView;
import com.isitjustme.room.RoomService.RoomView;
import com.isitjustme.room.RoomService.UniverseView;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class RoomController {

	private final RoomService roomService;

	@PostMapping
	public OpenResponse open(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@Valid @RequestBody NameRequest request) {
		return new OpenResponse(roomService.open(token, request.name()));
	}

	@GetMapping("/{shareToken}")
	public RoomView room(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String shareToken) {
		return roomService.room(token, shareToken);
	}

	@PostMapping("/{shareToken}/planets")
	public JoinResponse join(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String shareToken, @Valid @RequestBody NameRequest request) {
		return new JoinResponse(roomService.join(token, shareToken, request.name()));
	}

	@GetMapping("/{shareToken}/universe")
	public UniverseView universe(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String shareToken) {
		return roomService.universe(token, shareToken);
	}

	/**
	 * The owner compared with the viewer. There is no way to compare two other guests.
	 */
	@GetMapping("/{shareToken}/compare")
	public ComparisonView compare(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String shareToken) {
		return roomService.compare(token, shareToken);
	}

	public record OpenResponse(String shareToken) {
	}

	/**
	 * @param name 1 to 10 characters after trimming (checked by the service)
	 */
	public record NameRequest(@NotNull String name) {
	}

	public record JoinResponse(long planetId) {
	}

}
