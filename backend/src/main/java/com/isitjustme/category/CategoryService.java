package com.isitjustme.category;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryCatalog.CategoryInfo;
import com.isitjustme.category.CategoryCatalog.QuestionInfo;
import com.isitjustme.category.CategoryStatsCache.OverallBitStats;
import com.isitjustme.category.CategoryStatsCache.StatsSnapshot;
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

	private final CategoryStatsCache statsCache;

	private final CategoryAnswerRepository answerRepository;

	private final CombinationStatsRepository statsRepository;

	private final OverallAnswerRepository overallRepository;

	private final GuestService guestService;

	/**
	 * Categories with their questions, and when the guest last finished each of them.
	 */
	@Transactional(readOnly = true)
	public List<CategoryView> listCategories(@Nullable String rawToken) {
		Map<String, Long> participants = statsCache.participants().byCategory();
		Map<String, Double> rates = statsCache.option0Rates().byQuestion();
		Map<Long, Instant> completedAt = guestService.findByToken(rawToken)
			.map((guest) -> answerRepository.findByGuestId(guest.getId())
				.stream()
				.collect(Collectors.toMap(CategoryAnswer::getCategoryId, CategoryAnswer::getUpdatedAt)))
			.orElse(Map.of());

		return statsCache.catalog()
			.categories()
			.stream()
			.map((c) -> new CategoryView(c.code(), c.name(), c.icon(), c.description(), c.tagline(), c.minutes(),
					c.recommend(), participants.getOrDefault(c.code(), 0L), questionViews(c.questions(), rates),
					completedAt.get(c.id())))
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
		CategoryInfo category = findCategory(categoryCode);

		Instant now = Instant.now();
		Optional<CategoryAnswer> found = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.id());
		if (found.isPresent()) {
			CategoryAnswer answer = found.get();
			if (answer.matches(profile, answerBits)) {
				return;
			}
			statsRepository.decrement(category.id(), answer.profile(), answer.getAnswerBits());
			answer.update(profile, answerBits, now);
		}
		else {
			answerRepository.save(new CategoryAnswer(guest.getId(), category.id(), profile, answerBits, now));
		}
		statsRepository.increment(category.id(), profile, answerBits);
		Optional.ofNullable(completeAnswers(List.of(guest.getId())).get(guest.getId()))
			.ifPresent((answers) -> overallRepository.save(guest.getId(), overallBits(answers)));
	}

	/**
	 * Moves the guest's answers and their counts to the new profile, so results compare
	 * with the guest's current peers.
	 */
	@EventListener
	@Transactional(propagation = Propagation.MANDATORY)
	public void onProfileChanged(GuestProfileChanged event) {
		Instant now = Instant.now();
		for (CategoryAnswer answer : answerRepository.findByGuestId(event.guestId())) {
			if (answer.profile().equals(event.profile())) {
				continue;
			}
			statsRepository.decrement(answer.getCategoryId(), answer.profile(), answer.getAnswerBits());
			answer.changeProfile(event.profile(), now);
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
		CategoryInfo category = findCategory(categoryCode);
		CategoryAnswer answer = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.id())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

		StatsSnapshot stats = statsCache.stats(category.id());
		int myBits = answer.getAnswerBits();

		return new ResultView(myBits, RarityCalculator.summarize(stats.allWith(answer), myBits),
				new PeerView(answer.profile(), RarityCalculator.summarize(stats.peersWith(answer), myBits)),
				questionViews(category.questions(), statsCache.option0Rates().byQuestion()));
	}

	/**
	 * Per-group picks for each question of the category, for the detailed result. Only
	 * guests who answered the category can see it.
	 */
	@Transactional(readOnly = true)
	public QuestionStatsView questionStats(@Nullable String rawToken, String categoryCode) {
		Guest guest = guestService.findByToken(rawToken)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
		CategoryInfo category = findCategory(categoryCode);
		CategoryAnswer answer = answerRepository.findByGuestIdAndCategoryId(guest.getId(), category.id())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

		Map<String, List<GroupCount>> counts = statsCache.questionStats(category.id()).byQuestion();
		return new QuestionStatsView(answer.getAnswerBits(), category.questions()
			.stream()
			.map((q) -> new QuestionStats(q.code(), q.prompt(), q.option0(), q.option1(),
					counts.getOrDefault(q.code(), List.of())))
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
		long myBits = overallRepository.findBits(guest.getId())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
		int questionCount = statsCache.catalog().categories().size() * RarityCalculator.QUESTION_COUNT;
		OverallBitStats bitStats = bitStatsWith(guest.getId());
		long[] weights = RarityCalculator.rarityWeights(bitStats.participants(), bitStats.oneCounts(), questionCount);
		long rarer = overallRepository.countRarer(weights, RarityCalculator.rarityScore(myBits, weights));
		return new OverallResultView(questionCount,
				RarityCalculator.summarize(overallRepository.count(myBits, questionCount)),
				RarityCalculator.averageMatch(myBits, bitStats.participants(), bitStats.oneCounts(), questionCount),
				RarityCalculator.topPercent(rarer, bitStats.participants()));
	}

	/**
	 * The cached per-bit counts when they surely hold the guest's current answers, otherwise
	 * a fresh read, since {@link RarityCalculator#averageMatch} takes the guest back out of
	 * them. Answers change only through {@link #submit}, which also moves
	 * {@code updated_at}; a profile change moves it too, costing only a fresh read.
	 */
	private OverallBitStats bitStatsWith(Long guestId) {
		OverallBitStats cached = statsCache.overallBitStats();
		Instant changedAt = answerRepository.findByGuestId(guestId)
			.stream()
			.map(CategoryAnswer::getUpdatedAt)
			.max(Comparator.naturalOrder())
			.orElseThrow();
		return cached.includes(changedAt) ? cached : overallRepository.bitStats();
	}

	/**
	 * Each guest's answers in display order, only for the guests who answered every
	 * category.
	 */
	@Transactional(readOnly = true)
	public Map<Long, List<CategoryBits>> completeAnswers(Collection<Long> guestIds) {
		List<CategoryInfo> categories = statsCache.catalog().categories();
		Map<Long, Map<Long, Integer>> bitsByGuest = new HashMap<>();
		for (CategoryAnswer answer : answerRepository.findByGuestIdIn(guestIds)) {
			bitsByGuest.computeIfAbsent(answer.getGuestId(), (id) -> new HashMap<>())
				.put(answer.getCategoryId(), answer.getAnswerBits());
		}
		Map<Long, List<CategoryBits>> complete = new HashMap<>();
		bitsByGuest.forEach((guestId, bits) -> {
			if (categories.stream().allMatch((c) -> bits.containsKey(c.id()))) {
				complete.put(guestId,
						categories.stream().map((c) -> new CategoryBits(c.code(), bits.get(c.id()))).toList());
			}
		});
		return complete;
	}

	// Each category takes the next ten bits of a long, in display order (six categories = 60 bits).
	private static long overallBits(List<CategoryBits> answers) {
		long bits = 0;
		for (int i = 0; i < answers.size(); i++) {
			bits |= (long) answers.get(i).answerBits() << (i * RarityCalculator.QUESTION_COUNT);
		}
		return bits;
	}

	private CategoryInfo findCategory(String code) {
		return statsCache.catalog()
			.find(code)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}

	private static List<QuestionView> questionViews(List<QuestionInfo> questions, Map<String, Double> rates) {
		return questions.stream()
			.map((q) -> new QuestionView(q.code(), q.prompt(), q.option0(), q.option1(),
					Optional.ofNullable(rates.get(q.code()))
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
	 * @param averageMatch % of answers other guests have in common with mine on average, null
	 * when nobody else answered every category
	 * @param topPercent my rank from the rarest guest by {@code averageMatch}, as "top n%",
	 * null when nobody else answered every category
	 */
	public record OverallResultView(int questions, Summary overall, @Nullable Double averageMatch,
			@Nullable Double topPercent) {
	}

	/**
	 * @param answerBits bit n is 1 when question n+1 got option 1
	 */
	public record CategoryBits(String code, int answerBits) {
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
