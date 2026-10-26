package com.isitjustme.category;

import java.time.Instant;
import java.util.List;

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
 * A test topic such as food or love. Rows are managed with SQL migrations.
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

	@Column(nullable = false)
	private boolean active;

	@Column(nullable = false, updatable = false)
	private Instant createdAt;

}
