package com.isitjustme.guest;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GuestRepository extends JpaRepository<Guest, Long> {

	Optional<Guest> findByTokenHash(String tokenHash);

}
