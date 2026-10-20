package com.isitjustme.guest;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuestRepository extends JpaRepository<Guest, Long> {

	Optional<Guest> findByTokenHash(String tokenHash);

	@Modifying
	@Query("delete from Guest g where g.lastSeenAt < :cutoff")
	int deleteByLastSeenAtBefore(@Param("cutoff") Instant cutoff);

}
