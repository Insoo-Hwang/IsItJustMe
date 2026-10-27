package com.isitjustme.category;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A guest's current answer for a category. The profile is copied at submit time so the
 * answer always matches the {@code combination_stats} row it was counted in.
 */
@Entity
@Table(name = "category_answer")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CategoryAnswer {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, updatable = false)
	private Long guestId;

	@Column(nullable = false, updatable = false)
	private Long categoryId;

	@Column(nullable = false)
	private Long categoryVersionId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private Gender gender;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private AgeGroup ageGroup;

	@JdbcTypeCode(SqlTypes.SMALLINT)
	@Column(nullable = false)
	private int answerBits;

	@Column(nullable = false, updatable = false)
	private Instant completedAt;

	@Column(nullable = false)
	private Instant updatedAt;

	public CategoryAnswer(Long guestId, Long categoryId, Long categoryVersionId, GuestProfile profile, int answerBits,
			Instant now) {
		this.guestId = guestId;
		this.categoryId = categoryId;
		this.completedAt = now;
		update(categoryVersionId, profile, answerBits, now);
	}

	public void update(Long categoryVersionId, GuestProfile profile, int answerBits, Instant now) {
		this.categoryVersionId = categoryVersionId;
		this.gender = profile.gender();
		this.ageGroup = profile.ageGroup();
		this.answerBits = answerBits;
		this.updatedAt = now;
	}

	public void changeProfile(GuestProfile profile) {
		this.gender = profile.gender();
		this.ageGroup = profile.ageGroup();
	}

	public boolean matches(Long categoryVersionId, GuestProfile profile, int answerBits) {
		return this.categoryVersionId.equals(categoryVersionId) && profile().equals(profile)
				&& this.answerBits == answerBits;
	}

	public GuestProfile profile() {
		return new GuestProfile(gender, ageGroup);
	}

}
