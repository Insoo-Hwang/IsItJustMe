package com.isitjustme.room;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryService.CategoryBits;
import com.isitjustme.guest.Guest;
import com.isitjustme.guest.GuestService;
import com.isitjustme.guest.GuestTokens;
import com.isitjustme.room.RoomCards.RoomCard;
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

	private final RoomCards roomCards;

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
		found.ifPresent((room) -> {
			room.rename(name);
			// after commit, so a request in between cannot cache the old name again
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					roomCards.evict(room.getShareToken());
				}
			});
		});
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
		RoomCard room = roomCards.find(shareToken);
		ViewerView viewerView = guestService.findByToken(rawToken).map((guest) -> {
			if (guest.getId() == room.ownerGuestId()) {
				return new ViewerView(Role.OWNER, true, null);
			}
			Long planetId = planetRepository.findByRoomIdAndGuestId(room.id(), guest.getId())
				.map(UniversePlanet::getId)
				.orElse(null);
			return new ViewerView((planetId != null) ? Role.MEMBER : Role.VISITOR, isComplete(guest.getId()),
					planetId);
		}).orElse(new ViewerView(Role.VISITOR, false, null));
		return new RoomView(room.ownerName(), room.owner(), planetRepository.countByRoomId(room.id()), viewerView);
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
		RoomCard room = roomCards.find(shareToken);
		if (guest.getId() == room.ownerGuestId()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "owner cannot join");
		}
		requireComplete(guest.getId());
		return planetRepository.findByRoomIdAndGuestId(room.id(), guest.getId())
			.orElseGet(() -> planetRepository.save(new UniversePlanet(room.id(), guest.getId(), name, Instant.now())))
			.getId();
	}

	/**
	 * Every planet with its match to the owner, in join order. Only the match is shown;
	 * the answers stay hidden.
	 */
	@Transactional(readOnly = true)
	public UniverseView universe(@Nullable String rawToken, String shareToken) {
		RoomCard room = roomCards.find(shareToken);
		Long viewerId = guestService.findByToken(rawToken).map(Guest::getId).orElse(null);
		List<UniversePlanet> planets = planetRepository.findByRoomIdOrderById(room.id());
		Map<Long, List<CategoryBits>> answers = categoryService
			.completeAnswers(planets.stream().map(UniversePlanet::getGuestId).toList());

		return new UniverseView(planets.stream()
			.filter((p) -> answers.containsKey(p.getGuestId()))
			.map((p) -> new PlanetView(p.getId(), p.getName(),
					TasteMatch.compare(room.owner(), answers.get(p.getGuestId())).match(),
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
		RoomCard room = roomCards.find(shareToken);
		if (guest.getId() == room.ownerGuestId()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "owner cannot compare with self");
		}
		List<CategoryBits> mine = categoryService.completeAnswers(List.of(guest.getId())).get(guest.getId());
		if (mine == null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "answers incomplete");
		}
		Comparison comparison = TasteMatch.compare(room.owner(), mine);
		Optional<UniversePlanet> planet = planetRepository.findByRoomIdAndGuestId(room.id(), guest.getId());
		return new ComparisonView(room.ownerName(), planet.map(UniversePlanet::getId).orElse(null),
				planet.map(UniversePlanet::getName).orElse(null), comparison.match(), comparison.categories());
	}

	private boolean isComplete(Long guestId) {
		return categoryService.completeAnswers(List.of(guestId)).containsKey(guestId);
	}

	private void requireComplete(Long guestId) {
		if (!isComplete(guestId)) {
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
