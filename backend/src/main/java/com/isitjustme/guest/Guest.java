package com.isitjustme.guest;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.jspecify.annotations.Nullable;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "guest")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Guest {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 64)
	private String tokenHash;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant lastSeenAt;

	@Enumerated(EnumType.STRING)
	@Column(length = 10)
	private @Nullable Gender gender;

	@Enumerated(EnumType.STRING)
	@Column(length = 20)
	private @Nullable AgeGroup ageGroup;

	public Guest(String tokenHash, Instant now) {
		this.tokenHash = tokenHash;
		this.createdAt = now;
		this.lastSeenAt = now;
	}

	public void touch(Instant now) {
		this.lastSeenAt = now;
	}

	public void updateProfile(GuestProfile profile) {
		this.gender = profile.gender();
		this.ageGroup = profile.ageGroup();
	}

	public @Nullable GuestProfile profile() {
		return (gender == null || ageGroup == null) ? null : new GuestProfile(gender, ageGroup);
	}

}
