package com.isitjustme.room;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.isitjustme.category.CategoryService.CategoryBits;
import com.isitjustme.room.TasteMatch.CategoryMatch;
import com.isitjustme.room.TasteMatch.Comparison;

class TasteMatchTests {

	@Test
	void identicalAnswersMatchCompletely() {
		List<CategoryBits> answers = List.of(new CategoryBits("food", 0b1010), new CategoryBits("love", 0));

		Comparison comparison = TasteMatch.compare(answers, answers);

		assertThat(comparison.match()).isEqualTo(100);
		assertThat(comparison.categories()).extracting(CategoryMatch::matched).containsExactly(10, 10);
	}

	@Test
	void countsMatchingQuestionsPerCategory() {
		List<CategoryBits> owner = List.of(new CategoryBits("food", 0), new CategoryBits("love", 0));
		List<CategoryBits> other = List.of(new CategoryBits("food", 0b111), new CategoryBits("love", 0b11_1111_1111));

		Comparison comparison = TasteMatch.compare(owner, other);

		// 7 + 0 of 20 questions
		assertThat(comparison.match()).isEqualTo(35);
		assertThat(comparison.categories()).containsExactly(new CategoryMatch("food", 0, 0b111, 7),
				new CategoryMatch("love", 0, 0b11_1111_1111, 0));
	}

}
