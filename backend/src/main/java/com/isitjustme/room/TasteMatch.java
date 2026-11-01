package com.isitjustme.room;

import java.util.ArrayList;
import java.util.List;

import com.isitjustme.category.CategoryService.CategoryBits;

/**
 * Compares two guests' answers question by question. Only the owner is ever compared
 * with a member; members are never compared with each other.
 */
final class TasteMatch {

	private static final int QUESTION_COUNT = 10;

	private TasteMatch() {
	}

	/**
	 * @param owner the owner's answers in display order
	 * @param other the other guest's answers in the same order
	 */
	static Comparison compare(List<CategoryBits> owner, List<CategoryBits> other) {
		List<CategoryMatch> categories = new ArrayList<>();
		int matched = 0;
		for (int i = 0; i < owner.size(); i++) {
			int ownerBits = owner.get(i).answerBits();
			int otherBits = other.get(i).answerBits();
			int same = QUESTION_COUNT - Integer.bitCount(ownerBits ^ otherBits);
			categories.add(new CategoryMatch(owner.get(i).code(), ownerBits, otherBits, same));
			matched += same;
		}
		int questions = owner.size() * QUESTION_COUNT;
		int match = (questions > 0) ? (int) Math.round(matched * 100.0 / questions) : 0;
		return new Comparison(match, categories);
	}

	/**
	 * @param match % of all questions answered the same way
	 */
	record Comparison(int match, List<CategoryMatch> categories) {
	}

	/**
	 * @param matched questions of the category answered the same way
	 */
	record CategoryMatch(String code, int ownerBits, int otherBits, int matched) {
	}

}
