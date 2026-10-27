package com.isitjustme.category;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoryAnswerRepository extends JpaRepository<CategoryAnswer, Long> {

	Optional<CategoryAnswer> findByGuestIdAndCategoryId(Long guestId, Long categoryId);

	List<CategoryAnswer> findByGuestId(Long guestId);

	@Query("select a.categoryId as categoryId, count(a) as participants from CategoryAnswer a group by a.categoryId")
	List<CategoryParticipants> countByCategory();

	interface CategoryParticipants {

		Long getCategoryId();

		long getParticipants();

	}

}
