package com.isitjustme.room;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ShareRoomRepository extends JpaRepository<ShareRoom, Long> {

	Optional<ShareRoom> findByOwnerGuestId(Long ownerGuestId);

	Optional<ShareRoom> findByShareToken(String shareToken);

}
