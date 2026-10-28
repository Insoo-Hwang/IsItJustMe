package com.isitjustme.category;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.isitjustme.category.CategoryService.GroupCount;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;

import lombok.RequiredArgsConstructor;

/**
 * Per-combination answer counts. Written in the same transaction as
 * {@code category_answer}, so it can always be rebuilt from that table.
 */
@Repository
@RequiredArgsConstructor
class CombinationStatsRepository {

	private final JdbcClient jdbcClient;

	void increment(Long categoryId, GuestProfile profile, int answerBits) {
		jdbcClient.sql("""
				INSERT INTO combination_stats (category_id, gender, age_group, answer_bits, participant_count)
				VALUES (:categoryId, :gender, :ageGroup, :answerBits, 1)
				ON CONFLICT (category_id, gender, age_group, answer_bits)
				DO UPDATE SET participant_count = combination_stats.participant_count + 1
				""")
			.params(params(categoryId, profile, answerBits))
			.update();
	}

	void decrement(Long categoryId, GuestProfile profile, int answerBits) {
		jdbcClient.sql("""
				UPDATE combination_stats SET participant_count = participant_count - 1
				WHERE category_id = :categoryId AND gender = :gender AND age_group = :ageGroup
				  AND answer_bits = :answerBits AND participant_count > 0
				""")
			.params(params(categoryId, profile, answerBits))
			.update();
	}

	List<StatsRow> findByCategory(Long categoryId) {
		return jdbcClient.sql("""
				SELECT gender, age_group, answer_bits, participant_count FROM combination_stats
				WHERE category_id = :categoryId AND participant_count > 0
				""")
			.param("categoryId", categoryId)
			.query((rs, i) -> new StatsRow(new GuestProfile(Gender.valueOf(rs.getString(1)), AgeGroup.valueOf(rs.getString(2))),
					rs.getInt(3), rs.getLong(4)))
			.list();
	}

	/**
	 * Share of answers that picked option 0 for each question code. Codes nobody answered
	 * yet are left out.
	 */
	Map<String, Double> option0Rates(Collection<String> codes) {
		if (codes.isEmpty()) {
			return Map.of();
		}
		return jdbcClient.sql("""
				SELECT q.code,
				       SUM(s.participant_count) FILTER (WHERE (s.answer_bits >> q.bit_position) & 1 = 0) AS picked_0,
				       SUM(s.participant_count) AS total
				FROM question q
				JOIN combination_stats s ON s.category_id = q.category_id
				WHERE q.code IN (:codes)
				GROUP BY q.code
				HAVING SUM(s.participant_count) > 0
				""")
			.param("codes", codes)
			.query((rs, i) -> Map.entry(rs.getString(1), rs.getLong(2) / (double) rs.getLong(3)))
			.list()
			.stream()
			.collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	/**
	 * Option 0 picks per gender and age group for each question code. Groups nobody
	 * answered in are left out.
	 */
	Map<String, List<GroupCount>> option0CountsByGroup(Collection<String> codes) {
		if (codes.isEmpty()) {
			return Map.of();
		}
		return jdbcClient.sql("""
				SELECT q.code, s.gender, s.age_group,
				       SUM(s.participant_count) FILTER (WHERE (s.answer_bits >> q.bit_position) & 1 = 0) AS picked_0,
				       SUM(s.participant_count) AS total
				FROM question q
				JOIN combination_stats s ON s.category_id = q.category_id
				WHERE q.code IN (:codes)
				GROUP BY q.code, s.gender, s.age_group
				HAVING SUM(s.participant_count) > 0
				""")
			.param("codes", codes)
			.query((rs, i) -> Map.entry(rs.getString(1), new GroupCount(Gender.valueOf(rs.getString(2)),
					AgeGroup.valueOf(rs.getString(3)), rs.getLong(4), rs.getLong(5))))
			.list()
			.stream()
			.collect(Collectors.groupingBy(Map.Entry::getKey,
					Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
	}

	private static Map<String, Object> params(Long categoryId, GuestProfile profile, int answerBits) {
		return Map.of("categoryId", categoryId, "gender", profile.gender().name(), "ageGroup",
				profile.ageGroup().name(), "answerBits", answerBits);
	}

	record StatsRow(GuestProfile profile, int answerBits, long count) {
	}

}
