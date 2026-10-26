package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.isitjustme.category.CategoryService.CategoryView;
import com.isitjustme.category.CategoryService.ResultView;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestService;

@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ CategoryService.class, CombinationStatsRepository.class, GuestService.class })
class CategoryServiceTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	@Autowired
	private CategoryService categoryService;

	@Autowired
	private GuestService guestService;

	@Autowired
	private JdbcClient jdbcClient;

	@Test
	void listsSeededCategories() {
		List<CategoryView> categories = categoryService.listCategories();

		assertThat(categories).extracting(CategoryView::code)
			.containsExactly("food", "love", "life", "travel", "music", "people");
		assertThat(categories.getFirst().questions()).hasSize(10);
		assertThat(categories.getFirst().questions().getFirst().prompt()).isEqualTo("탕수육은?");
		assertThat(categories.getFirst().questions().getFirst().option0Rate()).isEqualTo(50);
	}

	@Test
	void resubmittingMovesTheCountToTheNewCombination() {
		String token = guestWithProfile(new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES));

		categoryService.submit(token, "food", 0b1);
		categoryService.submit(token, "food", 0b1);
		assertThat(countOf(0b1)).isEqualTo(1);

		categoryService.submit(token, "food", 0b11);
		assertThat(countOf(0b1)).isZero();
		assertThat(countOf(0b11)).isEqualTo(1);
	}

	@Test
	void resultComparesWithOtherGuests() {
		GuestProfile woman20s = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);
		String me = guestWithProfile(woman20s);
		categoryService.submit(me, "food", 0b0);
		categoryService.submit(guestWithProfile(woman20s), "food", 0b0);
		categoryService.submit(guestWithProfile(new GuestProfile(Gender.MALE, AgeGroup.FORTIES)), "food", 0b1);

		ResultView result = categoryService.result(me, "food");

		assertThat(result.answerBits()).isZero();
		assertThat(result.overall().participants()).isEqualTo(3);
		assertThat(result.overall().exact()).isEqualTo(1);
		assertThat(result.overall().similar()).isEqualTo(100.0);
		assertThat(result.peer().summary().participants()).isEqualTo(2);
		// bit 0 is "탕수육은?": two picked option 0, one picked option 1
		assertThat(result.questions().getFirst().option0Rate()).isEqualTo(67);
	}

	@Test
	void rejectsAnswerWithoutProfile() {
		String token = guestService.resolveOrIssue(null).token();

		assertThatThrownBy(() -> categoryService.submit(token, "food", 0)).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("409");
	}

	private String guestWithProfile(GuestProfile profile) {
		String token = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(token, profile);
		return token;
	}

	private long countOf(int answerBits) {
		return jdbcClient.sql("SELECT COALESCE(SUM(participant_count), 0) FROM combination_stats WHERE answer_bits = ?")
			.param(answerBits)
			.query(Long.class)
			.single();
	}

}
