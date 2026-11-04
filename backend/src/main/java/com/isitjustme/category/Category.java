package com.isitjustme.category;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A test topic such as food or love. Rows are added with SQL migrations; the texts
 * follow STORY.md ({@link StorySync}).
 */
@Entity
@Table(name = "category")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Category {

	@Id
	private Long id;

	@Column(nullable = false, unique = true, length = 50)
	private String code;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false, length = 50)
	private String icon;

	@Column(nullable = false, length = 200)
	private String description;

	@Column(nullable = false, length = 200)
	private String tagline;

	@Column(nullable = false)
	private int minutes;

	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(nullable = false, columnDefinition = "varchar(100)[]")
	private List<String> recommend;

	@Column(nullable = false)
	private int sortOrder;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * @return whether anything changed
	 */
	boolean updateTexts(String name, String icon, String description, String tagline, int minutes,
			List<String> recommend) {
		boolean changed = !(this.name.equals(name) && this.icon.equals(icon) && this.description.equals(description)
				&& this.tagline.equals(tagline) && this.minutes == minutes && Objects.equals(this.recommend, recommend));
		this.name = name;
		this.icon = icon;
		this.description = description;
		this.tagline = tagline;
		this.minutes = minutes;
		this.recommend = recommend;
		return changed;
	}

}
