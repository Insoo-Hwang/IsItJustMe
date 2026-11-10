package com.isitjustme.category;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;

import com.isitjustme.category.CategoryCatalog.CategoryInfo;
import com.isitjustme.category.CategoryCatalog.QuestionInfo;
import com.isitjustme.category.CategoryService.GroupCount;
import com.isitjustme.category.CombinationStatsRepository.StatsRow;
import com.isitjustme.config.CacheConfig;
import com.isitjustme.guest.GuestProfile;

import lombok.RequiredArgsConstructor;

/**
 * Reads that are the same for every guest, cached in Redis. A cached value can be older
 * than the latest answers by up to its cache's TTL ({@link CacheConfig}).
 */
@Component
@RequiredArgsConstructor
public class CategoryStatsCache {

	private final CategoryRepository categoryRepository;

	private final QuestionRepository questionRepository;

	private final CombinationStatsRepository statsRepository;

	private final OverallAnswerRepository overallRepository;

	@Cacheable(CacheConfig.CATEGORIES)
	public CategoryCatalog catalog() {
		List<Category> categories = categoryRepository.findAllByOrderBySortOrder();
		Map<Long, List<Question>> questionsByCategory = questionRepository
			.findByCategoryIdInOrderByBitPosition(categories.stream().map(Category::getId).toList())
			.stream()
			.collect(Collectors.groupingBy(Question::getCategoryId));
		return new CategoryCatalog(categories.stream()
			.map((c) -> new CategoryInfo(c.getId(), c.getCode(), c.getName(), c.getIcon(), c.getDescription(),
					c.getTagline(), c.getMinutes(), List.copyOf(c.getRecommend()),
					questionsByCategory.getOrDefault(c.getId(), List.of())
						.stream()
						.map((q) -> new QuestionInfo(q.getCode(), q.getPrompt(), q.getOption0(), q.getOption1()))
						.toList()))
			.toList());
	}

	@Cacheable(CacheConfig.PARTICIPANTS)
	public ParticipantCounts participants() {
		return new ParticipantCounts(statsRepository.participantsByCategory());
	}

	@Cacheable(CacheConfig.OPTION0_RATES)
	public Option0Rates option0Rates() {
		return new Option0Rates(statsRepository.option0Rates());
	}

	@Cacheable(cacheNames = CacheConfig.COMBINATION_STATS, key = "#categoryId")
	public StatsSnapshot stats(long categoryId) {
		Instant takenAt = Instant.now();
		return StatsSnapshot.of(takenAt, statsRepository.findByCategory(categoryId));
	}

	@Cacheable(cacheNames = CacheConfig.QUESTION_STATS, key = "#categoryId")
	public QuestionGroupCounts questionStats(long categoryId) {
		return new QuestionGroupCounts(statsRepository.option0CountsByGroup(categoryId));
	}

	@Cacheable(CacheConfig.OVERALL_BIT_STATS)
	public OverallBitStats overallBitStats() {
		return overallRepository.bitStats();
	}

	/**
	 * Seeds {@link OverallRanksHolder} from Redis, computing a table on a cache miss.
	 * The holder serializes initial loads and refreshes, including when Redis is down.
	 */
	@Cacheable(cacheNames = CacheConfig.OVERALL_RANKS, sync = true)
	public OverallRanks overallRanks() {
		return overallRepository.ranks();
	}

	@CachePut(CacheConfig.OVERALL_RANKS)
	public OverallRanks refreshOverallRanks() {
		return overallRepository.ranks();
	}

	/**
	 * @param byCategory answers per category code
	 */
	public record ParticipantCounts(Map<String, Long> byCategory) {
	}

	/**
	 * @param byQuestion share of answers that picked option 0, per question code. Codes
	 * nobody answered yet are left out.
	 */
	public record Option0Rates(Map<String, Double> byQuestion) {
	}

	/**
	 * A category's combination counts as they were at {@code takenAt}, one array per
	 * group. Arrays instead of rows keep the cached value small and quick to read.
	 */
	public record StatsSnapshot(Instant takenAt, List<GroupCounts> groups) {

		public StatsSnapshot {
			// a value cached in an older shape has no groups; failing here makes it re-read
			Objects.requireNonNull(groups, "groups");
		}

		static StatsSnapshot of(Instant takenAt, List<StatsRow> rows) {
			Map<GuestProfile, long[]> byProfile = new LinkedHashMap<>();
			rows.forEach((row) -> byProfile.computeIfAbsent(row.profile(),
					(profile) -> new long[RarityCalculator.COMBINATIONS])[row.answerBits()] += row.count());
			return new StatsSnapshot(takenAt, byProfile.entrySet()
				.stream()
				.map((entry) -> new GroupCounts(entry.getKey(), entry.getValue()))
				.toList());
		}

		/**
		 * Every group's counts with the guest's answer added when it was saved after the
		 * snapshot, since {@link RarityCalculator} expects the counts to include the guest.
		 * A guest who changed an answer after the snapshot is also still counted under the
		 * old one, so participants can be one too many until the snapshot expires.
		 */
		long[] allWith(CategoryAnswer answer) {
			return countsWith(answer, (profile) -> true);
		}

		/**
		 * Like {@link #allWith}, for the guest's own group only.
		 */
		long[] peersWith(CategoryAnswer answer) {
			return countsWith(answer, answer.profile()::equals);
		}

		private long[] countsWith(CategoryAnswer answer, Predicate<GuestProfile> included) {
			long[] counts = new long[RarityCalculator.COMBINATIONS];
			for (GroupCounts group : groups) {
				if (included.test(group.profile())) {
					for (int bits = 0; bits < counts.length; bits++) {
						counts[bits] += group.counts()[bits];
					}
				}
			}
			if (answer.getUpdatedAt().isAfter(takenAt)) {
				counts[answer.getAnswerBits()]++;
			}
			return counts;
		}

	}

	/**
	 * @param counts participants per answer combination, indexed by answer bits
	 */
	public record GroupCounts(GuestProfile profile, long[] counts) {
	}

	/**
	 * Guests who answered every category and their option 1 picks per bit of
	 * {@code overall_bits}, both read at {@code takenAt}.
	 * @param oneCounts guests whose answer has the bit set, by bit position
	 */
	public record OverallBitStats(Instant takenAt, long participants, long[] oneCounts) {

		/**
		 * An answer saved this long before the snapshot was taken is surely in it. Closer than
		 * that, the snapshot may have been read before the answer's transaction committed.
		 */
		static final Duration COMMIT_MARGIN = Duration.ofSeconds(10);

		/**
		 * Whether the counts surely hold the guest's answers as they were last changed at
		 * {@code changedAt}.
		 */
		boolean includes(Instant changedAt) {
			return changedAt.isBefore(takenAt.minus(COMMIT_MARGIN));
		}

	}

	/**
	 * Every complete guest's {@link RarityCalculator#rarityScore} as it was at
	 * {@code takenAt}, for ranking one guest without scoring everyone again. Scores only
	 * compare under the weights they were made with, so the weights travel with them.
	 * @param participants guests scored
	 * @param step 1 when {@code scores} holds every guest; otherwise only every
	 * {@code step}th score is kept, which bounds the size however many guests there are
	 * @param scores ascending
	 */
	public record OverallRanks(Instant takenAt, long participants, long[] weights, int step, long[] scores) {

		/** Enough for a rank shown to one decimal: a sampled rank is off by at most 0.025%. */
		static final int MAX_SAMPLES = 2000;

		static int stepFor(long participants, int maxSamples) {
			return (int) Math.max(1, (participants + maxSamples - 1) / maxSamples);
		}

		/** Whether every guest's score is here, so a rank from it is exact. */
		boolean exact() {
			return step == 1;
		}

		/** Like {@link OverallBitStats#includes}. */
		boolean includes(Instant changedAt) {
			return changedAt.isBefore(takenAt.minus(OverallBitStats.COMMIT_MARGIN));
		}

		/** Guests rarer than one with these answers. */
		long rarer(long bits) {
			return RarityCalculator.rarer(scores, step, participants, RarityCalculator.rarityScore(bits, weights));
		}

	}

	/**
	 * @param byQuestion option 0 picks per group, per question code
	 */
	public record QuestionGroupCounts(Map<String, List<GroupCount>> byQuestion) {
	}

}
