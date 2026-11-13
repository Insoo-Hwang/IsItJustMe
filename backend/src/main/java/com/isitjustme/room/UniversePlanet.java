package com.isitjustme.room;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.jspecify.annotations.Nullable;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A guest who joined the room's universe: everyone with the link sees the match, and the
 * owner also sees both sets of answers from the moment they joined.
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

	/** % of questions answered like the owner when joining; empty for older planets. */
	@Column(name = "match_percent", updatable = false)
	private @Nullable Integer match;

	/** The owner's answers when the friend joined, ten bits per category in display order. */
	@Column(updatable = false)
	private @Nullable Long ownerBits;

	/** The friend's answers when joining, laid out like {@link #ownerBits}. */
	@Column(updatable = false)
	private @Nullable Long planetBits;

	public UniversePlanet(Long roomId, Long guestId, String name, int match, long ownerBits, long planetBits,
			Instant now) {
		this.roomId = roomId;
		this.guestId = guestId;
		this.name = name;
		this.match = match;
		this.ownerBits = ownerBits;
		this.planetBits = planetBits;
		this.joinedAt = now;
	}

}
