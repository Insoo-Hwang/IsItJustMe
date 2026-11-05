package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

import com.isitjustme.category.StoryCategories.Entry;
import com.isitjustme.category.StoryCategories.QuestionText;
import com.isitjustme.category.StoryCategories.StoryException;

class StoryCategoriesTests {

	// LF line endings, so the edits below match on a Windows checkout too (core.autocrlf)
	private static String story() throws IOException {
		return Files.readString(Path.of("../STORY.md")).replace("\r\n", "\n");
	}

	@Test
	void readsEveryCategoryAndQuestion() throws IOException {
		StoryCategories story = StoryCategories.parse(story());

		assertThat(story.categories()).extracting(Entry::code)
			.containsExactly("food", "love", "life", "travel", "spending", "people");
		assertThat(story.categories()).allSatisfy((c) -> assertThat(c.questions()).hasSize(10));
		Entry food = story.categories().getFirst();
		assertThat(food.name()).isEqualTo("음식 취향");
		assertThat(food.icon()).isEqualTo("restaurant");
		assertThat(food.tagline()).isEqualTo("먹는 방식 하나로도 논쟁이 시작된다");
		assertThat(food.description()).isEqualTo("탕수육부터 민초까지, 양보 못 할 한 입");
		assertThat(food.minutes()).isEqualTo(1);
		assertThat(food.recommend()).containsExactly("메뉴 하나 고르다 토론한 분", "민초 논쟁에 참전해 본 분", "친구의 음식 취향이 궁금한 분");
		assertThat(food.questions().getFirst()).isEqualTo(new QuestionText("탕수육 소스, 어떻게 먹어?", "끝까지 찍먹", "처음부터 부먹"));
		assertThat(story.categories().getLast().questions().getLast())
			.isEqualTo(new QuestionText("모임이 길어지면?", "끝까지 같이 있어", "적당할 때 먼저 가"));
	}

	@Test
	void rejectsMissingQuestion() throws IOException {
		String broken = story().replace("| 10 | 평소 아침밥은? | 챙겨 먹는 편 | 거르는 편 |\n", "");

		assertThatThrownBy(() -> StoryCategories.parse(broken)).isInstanceOf(StoryException.class)
			.hasMessageContaining("`food` 문항은 10개여야 해요");
	}

	@Test
	void rejectsQuestionsOutOfOrder() throws IOException {
		String broken = story().replace("| 2 | 민트초코", "| 3 | 민트초코");

		assertThatThrownBy(() -> StoryCategories.parse(broken)).hasMessageContaining("문항 번호는 1부터 차례로");
	}

	@Test
	void rejectsCategoryWithoutQuestions() throws IOException {
		String broken = story().replace("### `people` 인간관계", "### `friends` 인간관계");

		assertThatThrownBy(() -> StoryCategories.parse(broken)).hasMessageContaining("`people`의 문항 표");
	}

	@Test
	void rejectsEmptyCellWithItsLine() throws IOException {
		String story = story();
		String broken = story.replace("| 끝까지 찍먹 |", "|  |");
		int line = (int) story.substring(0, story.indexOf("| 1 | 탕수육 소스")).lines().count() + 1;

		assertThatThrownBy(() -> StoryCategories.parse(broken)).hasMessage("STORY.md:" + line + ": 빈 칸이 있어요");
	}

	@Test
	void rejectsTooLongText() throws IOException {
		String broken = story().replace("| 1 | 탕수육 소스, 어떻게 먹어? |", "| 1 | " + "가".repeat(201) + " |");

		assertThatThrownBy(() -> StoryCategories.parse(broken)).hasMessageContaining("질문은 200자 이하");
	}

	@Test
	void rejectsNonNumericMinutes() throws IOException {
		String broken = story().replace("양보 못 할 한 입 | 1 |", "양보 못 할 한 입 | 한 |");

		assertThatThrownBy(() -> StoryCategories.parse(broken)).hasMessageContaining("시간(분)은 숫자");
	}

}
