package com.isitjustme.category;

import java.util.List;
import java.util.Optional;

/**
 * Every category with its questions, in display order. Cached without expiry; the cache
 * is cleared when STORY.md changes the texts ({@link StorySync}).
 */
public record CategoryCatalog(List<CategoryInfo> categories) {

	Optional<CategoryInfo> find(String code) {
		return categories.stream().filter((c) -> c.code().equals(code)).findFirst();
	}

	/**
	 * @param questions in bit order (question n is bit n - 1)
	 */
	public record CategoryInfo(long id, String code, String name, String icon, String description, String tagline,
			int minutes, List<String> recommend, List<QuestionInfo> questions) {
	}

	public record QuestionInfo(String code, String prompt, String option0, String option1) {
	}

}
