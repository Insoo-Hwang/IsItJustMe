package com.isitjustme.category;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryAnswerRepository.CategoryParticipants;
import com.isitjustme.category.CategoryAnswerRepository.GuestAnswer;
import com.isitjustme.category.CombinationStatsRepository.StatsRow;
import com.isitjustme.category.RarityCalculator.Summary;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.Guest;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestProfileChanged;
import com.isitjustme.guest.GuestService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CategoryService {

	/** Shown for a question nobody has answered yet. */
	private static final int DEFAULT_OPTION0_RATE = 50;

	private final CategoryRepository categoryRepository;

	private final QuestionRepository questionRepository;

	private final CategoryAnswerRepository answerRepository;

	private final CombinationStatsRepository statsRepository;

	private final GuestService guestService;

	/**
	 * Categories with their questions, and when the guest last finished each of them.
	 */
	@Transactional(readOnly = true)
	public List<CategoryView> listCategories(@Nullable String rawToken) {
		List<Category> categories = categoryRepository.findAllByOrderBySortOrder();
		Map<Long, List<Question>> questionsByCategory = questionRepository
			.findByCategoryIdInOrderByBitPosition(categories.stream().map(Category::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(Question::getCategoryId));
		Map<String, Double> rates = statsRepository.option0Rates(
				questionsByCategory.values().stream().flatMap(List::stream).map(Question::getCode).toList());
		Map<Long, Long> participants = answerRepository.countByCategory()
			.stream()
			.collect(Collectors.toMap(CategoryParticipants::getCategoryId, CategoryParticipants::getParticipants));
		Map<Long, Instant> completedAt = guestService.findByToken(rawToken)
			.map((guest) -> answerRepository.findByGuestId(guest.getId())
				.stream()
				.collect(Collectors.toMap(CategoryAnswer::getCategoryId, CategoryAnswer::getUpdatedAt)))
			.orElse(Map.of());

		return categories.stream()
			.map((c) -> new CategoryView(c.getCode(), c.getName(), c.getIcon(), c.getDescription(), c.getTagline(),
					c.getMinutes(), c.getRecommend(), participants.getOrDefault(c.getId(), 0L),
					questionViews(questionsByCategory.getOrDefault(c.getId(), List.of()), rates),
					completedAt.get(c.getId())))
			.toList();
	}

	/**
	 * Saves the guest's answer to the category and moves the guest's count from the
	 * previous combination to the new one.
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

		Instant now = Instant.now();
		Optional<CategoryAnswer> found = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.getId());
		if (found.isPresent()) {
			CategoryAnswer answer = found.get();
			if (answer.matches(profile, answerBits)) {
				return;
			}
			statsRepository.decrement(category.getId(), answer.profile(), answer.getAnswerBits());
			answer.update(profile, answerBits, now);
		}
		else {
			answerRepository.save(new CategoryAnswer(guest.getId(), category.getId(), profile, answerBits, now));
		}
		statsRepository.increment(category.getId(), profile, answerBits);
	}

	/**
	 * Moves the guest's answers and their counts to the new profile, so results compare
	 * with the guest's current peers.
	 */
	@EventListener
	@Transactional(propagation = Propagation.MANDATORY)
	public void onProfileChanged(GuestProfileChanged event) {
		for (CategoryAnswer answer : answerRepository.findByGuestId(event.guestId())) {
			if (answer.profile().equals(event.profile())) {
				continue;
			}
			statsRepository.decrement(answer.getCategoryId(), answer.profile(), answer.getAnswerBits());
			answer.changeProfile(event.profile());
			statsRepository.increment(answer.getCategoryId(), event.profile(), answer.getAnswerBits());
		}
	}

	/**
	 * The guest's saved answer compared with everyone who answered the category.
	 */
	@Transactional(readOnly = true)
	public ResultView result(@Nullable String rawToken, String categoryCode) {
		Guest guest = guestService.findByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		Category category = findCategory(categoryCode);
		CategoryAnswer answer = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.getId())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

		List<StatsRow> rows = statsRepository.findByCategory(category.getId());
		GuestProfile profile = answer.profile();
		List<StatsRow> peerRows = rows.stream().filter((row) -> row.profile().equals(profile)).toList();
		List<Question> questions = questionRepository.findByCategoryIdOrderByBitPosition(category.getId());
		Map<String, Double> rates = statsRepository.option0Rates(questions.stream().map(Question::getCode).toList());

		return new ResultView(answer.getAnswerBits(), RarityCalculator.summarize(rows, answer.getAnswerBits()),
				new PeerView(profile, RarityCalculator.summarize(peerRows, answer.getAnswerBits())),
				questionViews(questions, rates));
	}

	/**
	 * Per-group picks for each question of the category, for the detailed result. Only
	 * guests who answered the category can see it.
	 */
	@Transactional(readOnly = true)
	public QuestionStatsView questionStats(@Nullable String rawToken, String categoryCode) {
		Guest guest = guestService.findByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		Category category = findCategory(categoryCode);
		CategoryAnswer answer = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.getId())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

		List<Question> questions = questionRepository.findByCategoryIdOrderByBitPosition(category.getId());
		Map<String, List<GroupCount>> counts = statsRepository
			.option0CountsByGroup(questions.stream().map(Question::getCode).toList());
		return new QuestionStatsView(answer.getAnswerBits(), questions.stream()
			.map((q) -> new QuestionStats(q.getCode(), q.getPrompt(), q.getOption0(), q.getOption1(),
					counts.getOrDefault(q.getCode(), List.of())))
			.toList());
	}

	/**
	 * The guest's answers to every category compared as one combination with guests who
	 * answered all of them.
	 */
	@Transactional(readOnly = true)
	public OverallResultView overallResult(@Nullable String rawToken) {
		Guest guest = guestService.findByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		List<Category> categories = categoryRepository.findAllByOrderBySortOrder();
		Set<Long> answered = answerRepository.findByGuestId(guest.getId())
			.stream()
			.map(CategoryAnswer::getCategoryId)
			.collect(Collectors.toSet());
		if (!categories.stream().allMatch((c) -> answered.contains(c.getId()))) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND);
		}

		// Each category takes the next ten bits of a long, in display order (six categories = 60 bits).
		Map<Long, Integer> shiftByCategory = new HashMap<>();
		for (int i = 0; i < categories.size(); i++) {
			shiftByCategory.put(categories.get(i).getId(), i * RarityCalculator.QUESTION_COUNT);
		}
		Map<Long, Long> bitsByGuest = new HashMap<>();
		Map<Long, Integer> answeredByGuest = new HashMap<>();
		for (GuestAnswer answer : answerRepository.findByCategoryIdIn(shiftByCategory.keySet())) {
			long bits = (long) answer.getAnswerBits() << shiftByCategory.get(answer.getCategoryId());
			bitsByGuest.merge(answer.getGuestId(), bits, (a, b) -> a | b);
			answeredByGuest.merge(answer.getGuestId(), 1, Integer::sum);
		}
		Map<Long, Long> byCombination = new HashMap<>();
		answeredByGuest.forEach((guestId, count) -> {
			if (count == categories.size()) {
				byCombination.merge(bitsByGuest.get(guestId), 1L, Long::sum);
			}
		});

		int questionCount = categories.size() * RarityCalculator.QUESTION_COUNT;
		return new OverallResultView(questionCount,
				RarityCalculator.summarize(byCombination, bitsByGuest.get(guest.getId()), questionCount));
	}

	private Category findCategory(String code) {
		return categoryRepository.findByCode(code)
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

	/**
	 * @param completedAt when the guest last submitted answers, or null if never
	 */
	public record CategoryView(String code, String name, String icon, String description, String tagline, int minutes,
			List<String> recommend, long participants, List<QuestionView> questions, @Nullable Instant completedAt) {
	}

	/**
	 * @param option0Rate % of all answers that picked option 0
	 */
	public record QuestionView(String code, String prompt, String option0, String option1, int option0Rate) {
	}

	public record ResultView(int answerBits, Summary overall, PeerView peer, List<QuestionView> questions) {
	}

	public record PeerView(GuestProfile profile, Summary summary) {
	}

	/**
	 * @param questions questions compared across all categories
	 */
	public record OverallResultView(int questions, Summary overall) {
	}

	public record QuestionStatsView(int answerBits, List<QuestionStats> questions) {
	}

	public record QuestionStats(String code, String prompt, String option0, String option1, List<GroupCount> groups) {
	}

	/**
	 * @param option0 answers in the group that picked option 0
	 * @param total answers in the group
	 */
	public record GroupCount(Gender gender, AgeGroup ageGroup, long option0, long total) {
	}

}
