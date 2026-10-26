package com.isitjustme.category;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryAnswerRepository.CategoryParticipants;
import com.isitjustme.category.CategoryVersion.Status;
import com.isitjustme.category.CombinationStatsRepository.StatsRow;
import com.isitjustme.category.RarityCalculator.Summary;
import com.isitjustme.guest.Guest;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryService {

	/** Shown for a question nobody has answered yet. */
	private static final int DEFAULT_OPTION0_RATE = 50;

	private final CategoryRepository categoryRepository;

	private final CategoryVersionRepository versionRepository;

	private final QuestionRepository questionRepository;

	private final CategoryAnswerRepository answerRepository;

	private final CombinationStatsRepository statsRepository;

	private final GuestService guestService;

	/**
	 * Active categories with the questions of their published version.
	 */
	@Transactional(readOnly = true)
	public List<CategoryView> listCategories() {
		List<Category> categories = categoryRepository.findByActiveTrueOrderBySortOrder();
		Map<Long, Long> versionByCategory = versionRepository
			.findByCategoryIdInAndStatus(categories.stream().map(Category::getId).toList(), Status.PUBLISHED)
			.stream()
			.collect(Collectors.toMap(CategoryVersion::getCategoryId, CategoryVersion::getId));
		Map<Long, List<Question>> questionsByVersion = questionRepository
			.findByCategoryVersionIdInOrderByBitPosition(versionByCategory.values())
			.stream()
			.collect(Collectors.groupingBy(Question::getCategoryVersionId));
		Map<String, Double> rates = statsRepository.option0Rates(
				questionsByVersion.values().stream().flatMap(List::stream).map(Question::getCode).toList());
		Map<Long, Long> participants = answerRepository.countByCategory()
			.stream()
			.collect(Collectors.toMap(CategoryParticipants::getCategoryId, CategoryParticipants::getParticipants));

		return categories.stream()
			.filter((c) -> versionByCategory.containsKey(c.getId()))
			.map((c) -> new CategoryView(c.getCode(), c.getName(), c.getIcon(), c.getDescription(), c.getTagline(),
					c.getMinutes(), c.getRecommend(), participants.getOrDefault(c.getId(), 0L),
					questionViews(questionsByVersion.getOrDefault(versionByCategory.get(c.getId()), List.of()), rates)))
			.toList();
	}

	/**
	 * Saves the guest's answer to the published version of the category and moves the
	 * guest's count from the previous combination to the new one.
	 */
	@Transactional
	public void submit(@Nullable String rawToken, String categoryCode, int answerBits) {
		Guest guest = guestService.lockByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		GuestProfile profile = guest.profile();
		if (profile == null) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "profile required");
		}
		Category category = findCategory(categoryCode);
		Long versionId = versionRepository.findByCategoryIdAndStatus(category.getId(), Status.PUBLISHED)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND))
			.getId();

		Instant now = Instant.now();
		Optional<CategoryAnswer> found = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.getId());
		if (found.isPresent()) {
			CategoryAnswer answer = found.get();
			if (answer.matches(versionId, profile, answerBits)) {
				return;
			}
			statsRepository.decrement(answer.getCategoryVersionId(), answer.profile(), answer.getAnswerBits());
			answer.update(versionId, profile, answerBits, now);
		}
		else {
			answerRepository.save(new CategoryAnswer(guest.getId(), category.getId(), versionId, profile, answerBits, now));
		}
		statsRepository.increment(versionId, profile, answerBits);
	}

	/**
	 * The guest's saved answer compared with everyone who answered the same version.
	 */
	@Transactional(readOnly = true)
	public ResultView result(@Nullable String rawToken, String categoryCode) {
		Guest guest = guestService.findByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		Category category = findCategory(categoryCode);
		CategoryAnswer answer = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.getId())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

		List<StatsRow> rows = statsRepository.findByVersion(answer.getCategoryVersionId());
		GuestProfile profile = answer.profile();
		List<StatsRow> peerRows = rows.stream().filter((row) -> row.profile().equals(profile)).toList();
		List<Question> questions = questionRepository.findByCategoryVersionIdOrderByBitPosition(answer.getCategoryVersionId());
		Map<String, Double> rates = statsRepository.option0Rates(questions.stream().map(Question::getCode).toList());

		return new ResultView(answer.getAnswerBits(), RarityCalculator.summarize(rows, answer.getAnswerBits()),
				new PeerView(profile, RarityCalculator.summarize(peerRows, answer.getAnswerBits())),
				questionViews(questions, rates));
	}

	private Category findCategory(String code) {
		return categoryRepository.findByCodeAndActiveTrue(code)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}

	private static List<QuestionView> questionViews(List<Question> questions, Map<String, Double> rates) {
		return questions.stream()
			.map((q) -> new QuestionView(q.getCode(), q.getPrompt(), q.getOption0(), q.getOption1(),
					Optional.ofNullable(rates.get(q.getCode()))
						.map((rate) -> (int) Math.round(rate * 100))
						.orElse(DEFAULT_OPTION0_RATE)))
			.toList();
	}

	public record CategoryView(String code, String name, String icon, String description, String tagline, int minutes,
			List<String> recommend, long participants, List<QuestionView> questions) {
	}

	/**
	 * @param option0Rate % of all answers, across versions, that picked option 0
	 */
	public record QuestionView(String code, String prompt, String option0, String option1, int option0Rate) {
	}

	public record ResultView(int answerBits, Summary overall, PeerView peer, List<QuestionView> questions) {
	}

	public record PeerView(GuestProfile profile, Summary summary) {
	}

}
