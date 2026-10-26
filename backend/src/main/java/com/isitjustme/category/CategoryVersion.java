package com.isitjustme.category;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.jspecify.annotations.Nullable;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A fixed set of ten questions for a category. A published version is never edited;
 * changing questions means publishing a new version.
 */
@Entity
@Table(name = "category_version")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CategoryVersion {

	@Id
	private Long id;

	@Column(nullable = false)
	private Long categoryId;

	@Column(nullable = false)
	private int version;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Status status;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	private @Nullable Instant publishedAt;

	public enum Status {

		DRAFT, PUBLISHED, RETIRED

	}

}
