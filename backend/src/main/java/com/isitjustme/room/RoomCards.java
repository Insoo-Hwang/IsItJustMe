package com.isitjustme.room;

import java.util.List;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryService.CategoryBits;
import com.isitjustme.config.CacheConfig;

import lombok.RequiredArgsConstructor;

/**
 * A room and its owner's answers by share token, cached in Redis. Everyone opening the
 * same link reads the same card. An owner who retakes a test shows the old answers until
 * the card expires.
 */
@Component
@RequiredArgsConstructor
public class RoomCards {

	private final ShareRoomRepository roomRepository;

	private final CategoryService categoryService;

	@Cacheable(cacheNames = CacheConfig.ROOMS, key = "#shareToken")
	public RoomCard find(String shareToken) {
		ShareRoom room = roomRepository.findByShareToken(shareToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
		// Answers are overwritten, never deleted, so an owner stays complete once the room exists.
		List<CategoryBits> owner = categoryService.completeAnswers(List.of(room.getOwnerGuestId()))
			.get(room.getOwnerGuestId());
		if (owner == null) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND);
		}
		return new RoomCard(room.getId(), room.getOwnerGuestId(), room.getOwnerName(), owner);
	}

	// beforeInvocation removes the card right away; a plain evict may run later.
	@CacheEvict(cacheNames = CacheConfig.ROOMS, key = "#shareToken", beforeInvocation = true)
	public void evict(String shareToken) {
	}

	/**
	 * @param owner the owner's answers in display order
	 */
	public record RoomCard(long id, long ownerGuestId, String ownerName, List<CategoryBits> owner) {
	}

}
