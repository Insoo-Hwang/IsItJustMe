package com.isitjustme.category;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryService.CategoryView;
import com.isitjustme.category.CategoryService.OverallResultView;
import com.isitjustme.category.CategoryService.QuestionStatsView;
import com.isitjustme.category.CategoryService.ResultView;
import com.isitjustme.category.CategoryService.QuestionView;
import com.isitjustme.guest.GuestController;
import com.isitjustme.mvp.MvpMode;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

	private final CategoryService categoryService;

	private final MvpMode mvp;

	@GetMapping
	public List<CategoryView> list(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token) {
		List<CategoryView> categories = categoryService.listCategories(token);
		if (!mvp.locked()) {
			return categories;
		}
		return categories.stream()
			.map((c) -> new CategoryView(c.code(), c.name(), c.icon(), c.description(), c.tagline(), c.minutes(),
					c.recommend(), c.participants(), hideRates(c.questions()), c.completedAt()))
			.toList();
	}

	/**
	 * Saves the guest's ten answers as bits: bit n is 1 when question n+1 got option 1.
	 */
	@PutMapping("/{code}/answer")
	public ResponseEntity<Void> submit(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String code, @Valid @RequestBody AnswerRequest request) {
		categoryService.submit(token, code, request.answerBits());
		return ResponseEntity.noContent().build();
	}

	/**
	 * Result across every category, open once the guest answered all of them.
	 */
	@GetMapping("/result")
	public OverallResultView overallResult(
			@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token) {
		requireOpen();
		return categoryService.overallResult(token);
	}

	@GetMapping("/{code}/result")
	public ResultView result(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String code) {
		ResultView result = categoryService.result(token, code);
		if (!mvp.locked()) {
			return result;
		}
		// only the guest's own answers until the numbers open
		return new ResultView(result.answerBits(), null, null, hideRates(result.questions()));
	}

	@GetMapping("/{code}/result/questions")
	public QuestionStatsView questionStats(
			@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token, @PathVariable String code) {
		requireOpen();
		return categoryService.questionStats(token, code);
	}

	/** In MVP mode the numbers that compare with everyone else stay closed. */
	private void requireOpen() {
		if (mvp.locked()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "mvp locked");
		}
	}

	/** Every question shown as an even split, so no pick rate leaks before the numbers open. */
	private static List<QuestionView> hideRates(List<QuestionView> questions) {
		return questions.stream()
			.map((q) -> new QuestionView(q.code(), q.prompt(), q.option0(), q.option1(), 50))
			.toList();
	}

	public record AnswerRequest(@NotNull @Min(0) @Max(1023) Integer answerBits) {
	}

}
