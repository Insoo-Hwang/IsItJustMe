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
 * A guest who agreed to show their match with the owner in the room's universe.
 */
@Entity
@Table(name = "universe_planet")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UniversePlanet {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, updatable = false)
	private Long roomId;

	@Column(nullable = false, updatable = false)
	private Long guestId;

	@Column(nullable = false, length = RoomService.NAME_MAX_LENGTH)
	private String name;

	@Column(nullable = false, updatable = false)
	private Instant joinedAt;

	public UniversePlanet(Long roomId, Long guestId, String name, Instant now) {
		this.roomId = roomId;
		this.guestId = guestId;
		this.name = name;
		this.joinedAt = now;
	}

}
