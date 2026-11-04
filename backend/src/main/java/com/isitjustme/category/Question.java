package com.isitjustme.category;

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
 * One question of a category. Picking {@code option0} stores 0 at {@code bitPosition}
 * of the answer bits, picking {@code option1} stores 1.
 */
@Entity
@Table(name = "question")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Question {

	@Id
	private Long id;

	@Column(nullable = false)
	private Long categoryId;

	@JdbcTypeCode(SqlTypes.SMALLINT)
	@Column(nullable = false)
	private int bitPosition;

	@Column(nullable = false, length = 50)
	private String code;

	@Column(nullable = false, length = 200)
	private String prompt;

	@Column(name = "option_0", nullable = false, length = 100)
	private String option0;

	@Column(name = "option_1", nullable = false, length = 100)
	private String option1;

	/**
	 * @return whether anything changed
	 */
	boolean updateTexts(String prompt, String option0, String option1) {
		boolean changed = !(this.prompt.equals(prompt) && this.option0.equals(option0) && this.option1.equals(option1));
		this.prompt = prompt;
		this.option0 = option0;
		this.option1 = option1;
		return changed;
	}

}
