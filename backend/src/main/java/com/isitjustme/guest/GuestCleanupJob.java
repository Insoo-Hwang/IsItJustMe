package com.isitjustme.guest;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
class GuestCleanupJob {

	private final GuestService guestService;

	@Scheduled(cron = "${app.guest.cleanup-cron}", zone = "Asia/Seoul")
	void deleteInactiveGuests() {
		int deleted = guestService.deleteInactive();
		log.info("Deleted {} inactive guests", deleted);
	}

}
