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
import com.isitjustme.category.CategoryService.GroupCount;
import com.isitjustme.category.CategoryService.OverallResultView;
import com.isitjustme.category.CategoryService.QuestionStatsView;
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

	private static final List<String> CATEGORY_CODES = List.of("food", "love", "life", "travel", "spending", "people");

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
			.containsExactly("food", "love", "life", "travel", "spending", "people");
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
	void questionStatsCountPicksPerGroup() {
		GuestProfile woman20s = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);
		String me = guestWithProfile(woman20s);
		categoryService.submit(me, "food", 0b0);
		categoryService.submit(guestWithProfile(woman20s), "food", 0b1);
		categoryService.submit(guestWithProfile(new GuestProfile(Gender.MALE, AgeGroup.FORTIES)), "food", 0b1);

		QuestionStatsView stats = categoryService.questionStats(me, "food");

		assertThat(stats.answerBits()).isZero();
		assertThat(stats.questions()).hasSize(10);
		assertThat(stats.questions().getFirst().groups()).containsExactlyInAnyOrder(
				new GroupCount(Gender.FEMALE, AgeGroup.TWENTIES, 1, 2),
				new GroupCount(Gender.MALE, AgeGroup.FORTIES, 0, 1));
	}

	@Test
	void changingProfileMovesExistingAnswers() {
		GuestProfile woman20s = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);
		GuestProfile man30s = new GuestProfile(Gender.MALE, AgeGroup.THIRTIES);
		String me = guestWithProfile(woman20s);
		categoryService.submit(me, "food", 0b1);
		categoryService.submit(guestWithProfile(man30s), "food", 0b1);

		guestService.updateProfile(me, man30s);

		ResultView result = categoryService.result(me, "food");
		assertThat(result.peer().profile()).isEqualTo(man30s);
		assertThat(result.peer().summary().participants()).isEqualTo(2);
		assertThat(countOf(0b1, woman20s)).isZero();
		assertThat(countOf(0b1, man30s)).isEqualTo(2);
	}

	@Test
	void overallResultComparesGuestsWhoAnsweredEveryCategory() {
		GuestProfile woman20s = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);
		String me = guestWithProfile(woman20s);
		String same = guestWithProfile(woman20s);
		String close = guestWithProfile(woman20s);
		String unfinished = guestWithProfile(woman20s);
		for (String code : CATEGORY_CODES) {
			categoryService.submit(me, code, 0);
			categoryService.submit(same, code, 0);
			categoryService.submit(close, code, 0b11);
			if (!code.equals("people")) {
				categoryService.submit(unfinished, code, 0);
			}
		}

		OverallResultView result = categoryService.overallResult(me);

		assertThat(result.questions()).isEqualTo(60);
		assertThat(result.overall().participants()).isEqualTo(3);
		assertThat(result.overall().exact()).isEqualTo(1);
		// close differs in 12 of 60 answers, so both others are similar
		assertThat(result.overall().similar()).isEqualTo(100.0);
		assertThatThrownBy(() -> categoryService.overallResult(unfinished)).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("404");
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

	private long countOf(int answerBits, GuestProfile profile) {
		return jdbcClient.sql("""
				SELECT COALESCE(SUM(participant_count), 0) FROM combination_stats
				WHERE answer_bits = ? AND gender = ? AND age_group = ?
				""")
			.params(answerBits, profile.gender().name(), profile.ageGroup().name())
			.query(Long.class)
			.single();
	}

	private long countOf(int answerBits) {
		return jdbcClient.sql("SELECT COALESCE(SUM(participant_count), 0) FROM combination_stats WHERE answer_bits = ?")
			.param(answerBits)
			.query(Long.class)
			.single();
	}

}
