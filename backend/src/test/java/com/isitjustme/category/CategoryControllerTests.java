package com.isitjustme.category;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryService.CategoryView;
import com.isitjustme.category.CategoryService.OverallResultView;
import com.isitjustme.category.CategoryService.PeerView;
import com.isitjustme.category.CategoryService.QuestionView;
import com.isitjustme.category.CategoryService.GroupCount;
import com.isitjustme.category.CategoryService.QuestionStats;
import com.isitjustme.category.CategoryService.QuestionStatsView;
import com.isitjustme.category.CategoryService.ResultView;
import com.isitjustme.category.RarityCalculator.Summary;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;

@WebMvcTest(CategoryController.class)
class CategoryControllerTests {

	private static final QuestionView QUESTION = new QuestionView("food-01", "탕수육은?", "찍먹", "부먹", 38);

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private CategoryService categoryService;

	@Test
	void listsCategories() throws Exception {
		given(categoryService.listCategories("token")).willReturn(List.of(new CategoryView("food", "음식 취향", "restaurant",
				"찍먹부터 민초까지", "사소한 음식 취향", 1, List.of("음식 얘기만 해도 신나는 분"), 12, List.of(QUESTION),
				Instant.parse("2026-10-28T13:00:00Z"))));

		mockMvc.perform(get("/api/v1/categories").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].code").value("food"))
			.andExpect(jsonPath("$[0].participants").value(12))
			.andExpect(jsonPath("$[0].questions[0].option0").value("찍먹"))
			.andExpect(jsonPath("$[0].questions[0].option0Rate").value(38))
			.andExpect(jsonPath("$[0].completedAt").value("2026-10-28T13:00:00Z"));
	}

	@Test
	void savesAnswer() throws Exception {
		mockMvc.perform(put("/api/v1/categories/food/answer").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"answerBits": 717}
					"""))
			.andExpect(status().isNoContent());

		then(categoryService).should().submit("token", "food", 717);
	}

	@Test
	void rejectsAnswerBitsOutOfRange() throws Exception {
		mockMvc.perform(put("/api/v1/categories/food/answer").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"answerBits": 1024}
					"""))
			.andExpect(status().isBadRequest());

		then(categoryService).should(never()).submit(any(), any(), anyInt());
	}

	@Test
	void rejectsAnswerWithoutProfile() throws Exception {
		willThrow(new ResponseStatusException(HttpStatus.CONFLICT)).given(categoryService)
			.submit("token", "food", 3);

		mockMvc.perform(put("/api/v1/categories/food/answer").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"answerBits": 3}
					"""))
			.andExpect(status().isConflict());
	}

	@Test
	void returnsResult() throws Exception {
		GuestProfile profile = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);
		given(categoryService.result("token", "food")).willReturn(new ResultView(717, new Summary(100, 2, 12.1, 3.5, 1),
				new PeerView(profile, new Summary(20, 0, 5.3, 0, 0)), List.of(QUESTION)));

		mockMvc.perform(get("/api/v1/categories/food/result").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.answerBits").value(717))
			.andExpect(jsonPath("$.overall.participants").value(100))
			.andExpect(jsonPath("$.overall.exact").value(2))
			.andExpect(jsonPath("$.overall.similar").value(12.1))
			.andExpect(jsonPath("$.overall.opposite").value(3.5))
			.andExpect(jsonPath("$.overall.different").value(1))
			.andExpect(jsonPath("$.peer.profile.ageGroup").value("TWENTIES"))
			.andExpect(jsonPath("$.peer.summary.exact").value(0))
			.andExpect(jsonPath("$.questions[0].code").value("food-01"));
	}

	@Test
	void returnsOverallResult() throws Exception {
		given(categoryService.overallResult("token")).willReturn(new OverallResultView(60, new Summary(300, 3, 0.8, 1.2, 0)));

		mockMvc.perform(get("/api/v1/categories/result").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.questions").value(60))
			.andExpect(jsonPath("$.overall.participants").value(300))
			.andExpect(jsonPath("$.overall.exact").value(3))
			.andExpect(jsonPath("$.overall.similar").value(0.8));
	}

	@Test
	void returnsQuestionStats() throws Exception {
		given(categoryService.questionStats("token", "food")).willReturn(new QuestionStatsView(1,
				List.of(new QuestionStats("food-01", "탕수육은?", "부먹", "찍먹",
						List.of(new GroupCount(Gender.MALE, AgeGroup.THIRTIES, 3, 5))))));

		mockMvc.perform(get("/api/v1/categories/food/result/questions").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.answerBits").value(1))
			.andExpect(jsonPath("$.questions[0].option1").value("찍먹"))
			.andExpect(jsonPath("$.questions[0].groups[0].ageGroup").value("THIRTIES"))
			.andExpect(jsonPath("$.questions[0].groups[0].option0").value(3))
			.andExpect(jsonPath("$.questions[0].groups[0].total").value(5));
	}

	@Test
	void resultWithoutAnswerIsNotFound() throws Exception {
		given(categoryService.result("token", "food")).willThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));

		mockMvc.perform(get("/api/v1/categories/food/result").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isNotFound());
	}

}
