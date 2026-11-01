package com.isitjustme.room;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryService.CategoryBits;
import com.isitjustme.guest.Guest;
import com.isitjustme.guest.GuestService;
import com.isitjustme.guest.GuestTokens;
import com.isitjustme.room.TasteMatch.CategoryMatch;
import com.isitjustme.room.TasteMatch.Comparison;

import lombok.RequiredArgsConstructor;

/**
 * Share rooms and their universes. The owner sits in the middle and each planet is
 * compared with the owner only; the details of a comparison are shown only to the
 * guest being compared. Comparisons are not stored; they come from the current answers.
 */
@Service
@RequiredArgsConstructor
public class RoomService {

	static final int NAME_MAX_LENGTH = 10;

	private final ShareRoomRepository roomRepository;

	private final UniversePlanetRepository planetRepository;

	private final CategoryService categoryService;

	private final GuestService guestService;

	/**
	 * Returns the share token of the guest's room, creating the room on first use. A
	 * room shared again shows the new name. Only guests who answered every category can
	 * share.
	 */
	@Transactional
	public String open(@Nullable String rawToken, String ownerName) {
		String name = validName(ownerName);
		Guest guest = guestService.lockByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		requireComplete(guest.getId());
		Optional<ShareRoom> found = roomRepository.findByOwnerGuestId(guest.getId());
		found.ifPresent((room) -> room.rename(name));
		return found
			.orElseGet(() -> roomRepository.save(new ShareRoom(guest.getId(), GuestTokens.generate(), name, Instant.now())))
			.getShareToken();
	}

	/**
	 * The owner's name and answers for the invite page, and how the viewer relates to the
	 * room.
	 */
	@Transactional(readOnly = true)
	public RoomView room(@Nullable String rawToken, String shareToken) {
		ShareRoom room = findRoom(shareToken);
		Optional<Guest> viewer = guestService.findByToken(rawToken);
		List<Long> guestIds = new ArrayList<>(List.of(room.getOwnerGuestId()));
		viewer.ifPresent((guest) -> guestIds.add(guest.getId()));
		Map<Long, List<CategoryBits>> answers = categoryService.completeAnswers(guestIds);

		ViewerView viewerView = viewer.map((guest) -> {
			if (guest.getId().equals(room.getOwnerGuestId())) {
				return new ViewerView(Role.OWNER, true, null);
			}
			Long planetId = planetRepository.findByRoomIdAndGuestId(room.getId(), guest.getId())
				.map(UniversePlanet::getId)
				.orElse(null);
			return new ViewerView((planetId != null) ? Role.MEMBER : Role.VISITOR, answers.containsKey(guest.getId()),
					planetId);
		}).orElse(new ViewerView(Role.VISITOR, false, null));
		return new RoomView(room.getOwnerName(), ownerAnswers(room, answers),
				planetRepository.countByRoomId(room.getId()), viewerView);
	}

	/**
	 * Adds the guest to the room's universe under the given name, or returns the existing
	 * planet.
	 */
	@Transactional
	public long join(@Nullable String rawToken, String shareToken, String planetName) {
		String name = validName(planetName);
		Guest guest = guestService.lockByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		ShareRoom room = findRoom(shareToken);
		if (guest.getId().equals(room.getOwnerGuestId())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "owner cannot join");
		}
		requireComplete(guest.getId());
		return planetRepository.findByRoomIdAndGuestId(room.getId(), guest.getId())
			.orElseGet(() -> planetRepository.save(new UniversePlanet(room.getId(), guest.getId(), name, Instant.now())))
			.getId();
	}

	/**
	 * Every planet with its match to the owner, in join order. Only the match is shown;
	 * the answers stay hidden.
	 */
	@Transactional(readOnly = true)
	public UniverseView universe(@Nullable String rawToken, String shareToken) {
		ShareRoom room = findRoom(shareToken);
		Long viewerId = guestService.findByToken(rawToken).map(Guest::getId).orElse(null);
		List<UniversePlanet> planets = planetRepository.findByRoomIdOrderById(room.getId());
		List<Long> guestIds = new ArrayList<>(List.of(room.getOwnerGuestId()));
		planets.forEach((p) -> guestIds.add(p.getGuestId()));
		Map<Long, List<CategoryBits>> answers = categoryService.completeAnswers(guestIds);
		List<CategoryBits> owner = ownerAnswers(room, answers);

		return new UniverseView(planets.stream()
			.filter((p) -> answers.containsKey(p.getGuestId()))
			.map((p) -> new PlanetView(p.getId(), p.getName(),
					TasteMatch.compare(owner, answers.get(p.getGuestId())).match(),
					Objects.equals(p.getGuestId(), viewerId)))
			.toList());
	}

	/**
	 * The owner compared with the viewer, whether or not the viewer joined the universe.
	 * This is the only detailed comparison: nobody sees two other people compared.
	 */
	@Transactional(readOnly = true)
	public ComparisonView compare(@Nullable String rawToken, String shareToken) {
		Guest guest = guestService.findByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		ShareRoom room = findRoom(shareToken);
		if (guest.getId().equals(room.getOwnerGuestId())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "owner cannot compare with self");
		}
		Map<Long, List<CategoryBits>> answers = categoryService
			.completeAnswers(List.of(room.getOwnerGuestId(), guest.getId()));
		List<CategoryBits> mine = answers.get(guest.getId());
		if (mine == null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "answers incomplete");
		}
		Comparison comparison = TasteMatch.compare(ownerAnswers(room, answers), mine);
		Optional<UniversePlanet> planet = planetRepository.findByRoomIdAndGuestId(room.getId(), guest.getId());
		return new ComparisonView(room.getOwnerName(), planet.map(UniversePlanet::getId).orElse(null),
				planet.map(UniversePlanet::getName).orElse(null), comparison.match(), comparison.categories());
	}

	private ShareRoom findRoom(String shareToken) {
		return roomRepository.findByShareToken(shareToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}

	private void requireComplete(Long guestId) {
		if (!categoryService.completeAnswers(List.of(guestId)).containsKey(guestId)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "answers incomplete");
		}
	}

	private static String validName(String name) {
		String trimmed = name.strip();
		if (trimmed.isEmpty() || trimmed.length() > NAME_MAX_LENGTH) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid name");
		}
		return trimmed;
	}

	// Answers are overwritten, never deleted, so an owner stays complete once the room exists.
	private static List<CategoryBits> ownerAnswers(ShareRoom room, Map<Long, List<CategoryBits>> answers) {
		List<CategoryBits> owner = answers.get(room.getOwnerGuestId());
		if (owner == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND);
		}
		return owner;
	}

	public enum Role {

		OWNER, MEMBER, VISITOR

	}

	/**
	 * @param owner the owner's answers in display order
	 * @param planets guests who joined the universe
	 */
	public record RoomView(String ownerName, List<CategoryBits> owner, long planets, ViewerView viewer) {
	}

	/**
	 * @param complete whether the viewer answered every category
	 * @param planetId the viewer's planet, when the viewer joined
	 */
	public record ViewerView(Role role, boolean complete, @Nullable Long planetId) {
	}

	public record UniverseView(List<PlanetView> planets) {
	}

	/**
	 * @param match % of all questions answered the same way as the owner
	 * @param me whether this planet is the viewer
	 */
	public record PlanetView(long id, String name, int match, boolean me) {
	}

	/**
	 * @param planetId the viewer's planet, null when the viewer has not joined
	 * @param planetName the viewer's planet name, null when the viewer has not joined
	 * @param match % of all questions answered the same way
	 */
	public record ComparisonView(String ownerName, @Nullable Long planetId, @Nullable String planetName, int match,
			List<CategoryMatch> categories) {
	}

}
