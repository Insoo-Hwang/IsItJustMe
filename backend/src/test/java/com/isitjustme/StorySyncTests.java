package com.isitjustme;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import com.isitjustme.category.CategoryCatalog.CategoryInfo;
import com.isitjustme.category.CategoryCatalog.QuestionInfo;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.category.StorySync;

/**
 * STORY.md texts reach the database and the cached catalog.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class StorySyncTests {

	@Autowired
	private StorySync storySync;

	@Autowired
	private CategoryStatsCache statsCache;

	private static String story() throws IOException {
		return Files.readString(Path.of("../STORY.md"));
	}

	@AfterEach
	void restore() throws IOException {
		storySync.apply(story());
	}

	@Test
	void unchangedStoryChangesNothing() throws IOException {
		assertThat(storySync.apply(story())).isFalse();
	}

	@Test
	void changedTextsReachTheCatalog() throws IOException {
		// read once so the catalog is cached before the change
		assertThat(statsCache.catalog().categories().getFirst().name()).isEqualTo("음식 취향");
		String changed = story().replace("| `food` | 음식 취향 |", "| `food` | 먹는 취향 |")
			.replace("| 1 | 탕수육 소스, 어떻게 먹어? |", "| 1 | 탕수육 먹을 때는? |");

		assertThat(storySync.apply(changed)).isTrue();

		CategoryInfo food = statsCache.catalog().categories().getFirst();
		assertThat(food.name()).isEqualTo("먹는 취향");
		assertThat(food.questions().getFirst()).isEqualTo(new QuestionInfo("food-01", "탕수육 먹을 때는?", "끝까지 찍먹", "처음부터 부먹"));
		assertThat(food.questions().get(1).prompt()).isEqualTo("민트초코 아이스크림이 눈앞에 있다면?");
	}

	@Test
	void reorderedCategoriesAreRejected() throws IOException {
		String food = "| `food` | 음식 취향 |";
		String love = "| `love` | 연애 취향 |";
		String swapped = story().replace(food, "@@").replace(love, food).replace("@@", love);

		assertThatThrownBy(() -> storySync.apply(swapped)).isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("순서 그대로");
		assertThat(statsCache.catalog().categories().getFirst().code()).isEqualTo("food");
	}

}
