package com.isitjustme.room;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UniversePlanetRepository extends JpaRepository<UniversePlanet, Long> {

	/** Planets in the order they joined. */
	List<UniversePlanet> findByRoomIdOrderById(Long roomId);

	Optional<UniversePlanet> findByRoomIdAndGuestId(Long roomId, Long guestId);

	long countByRoomId(Long roomId);

}
