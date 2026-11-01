package com.isitjustme.room;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A guest's share room. Anyone with the share token can see the owner's results and
 * the room's universe.
 */
@Entity
@Table(name = "share_room")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShareRoom {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, updatable = false)
	private Long ownerGuestId;

	@Column(nullable = false, unique = true, updatable = false, length = 64)
	private String shareToken;

	@Column(nullable = false, length = RoomService.NAME_MAX_LENGTH)
	private String ownerName;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	public ShareRoom(Long ownerGuestId, String shareToken, String ownerName, Instant now) {
		this.ownerGuestId = ownerGuestId;
		this.shareToken = shareToken;
		this.ownerName = ownerName;
		this.createdAt = now;
	}

	public void rename(String ownerName) {
		this.ownerName = ownerName;
	}

}
