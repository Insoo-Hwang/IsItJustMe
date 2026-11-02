package com.isitjustme.category;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryAnswerRepository extends JpaRepository<CategoryAnswer, Long> {

	Optional<CategoryAnswer> findByGuestIdAndCategoryId(Long guestId, Long categoryId);

	List<CategoryAnswer> findByGuestId(Long guestId);

	List<CategoryAnswer> findByGuestIdIn(Collection<Long> guestIds);

}
