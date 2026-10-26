package com.isitjustme.category;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.isitjustme.category.CategoryVersion.Status;

public interface CategoryVersionRepository extends JpaRepository<CategoryVersion, Long> {

	Optional<CategoryVersion> findByCategoryIdAndStatus(Long categoryId, Status status);

	List<CategoryVersion> findByCategoryIdInAndStatus(Collection<Long> categoryIds, Status status);

}
