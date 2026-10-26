package com.isitjustme.guest;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuestRepository extends JpaRepository<Guest, Long> {

	Optional<Guest> findByTokenHash(String tokenHash);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select g from Guest g where g.tokenHash = :tokenHash")
	Optional<Guest> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

}
