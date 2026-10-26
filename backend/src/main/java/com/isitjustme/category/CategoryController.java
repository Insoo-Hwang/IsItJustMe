package com.isitjustme.category;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.isitjustme.category.CategoryService.CategoryView;
import com.isitjustme.category.CategoryService.ResultView;
import com.isitjustme.guest.GuestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

	private final CategoryService categoryService;

	@GetMapping
	public List<CategoryView> list() {
		return categoryService.listCategories();
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

	@GetMapping("/{code}/result")
	public ResultView result(@CookieValue(name = GuestController.COOKIE_NAME, required = false) String token,
			@PathVariable String code) {
		return categoryService.result(token, code);
	}

	public record AnswerRequest(@NotNull @Min(0) @Max(1023) Integer answerBits) {
	}

}
