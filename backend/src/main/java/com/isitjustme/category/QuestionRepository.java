package com.isitjustme.category;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepository extends JpaRepository<Question, Long> {

	List<Question> findByCategoryVersionIdOrderByBitPosition(Long categoryVersionId);

	List<Question> findByCategoryVersionIdInOrderByBitPosition(Collection<Long> categoryVersionIds);

}
