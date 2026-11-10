package com.isitjustme.category;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Scores every complete guest again every few minutes, so no request waits for it. The
 * first run comes one period after startup; until then a request computes the scores
 * itself. With several servers each one refreshes the shared value, which only repeats
 * the work.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class OverallRanksRefresher {

	private final CategoryStatsCache statsCache;

	@Scheduled(initialDelayString = "${overall.ranks.refresh:PT5M}", fixedDelayString = "${overall.ranks.refresh:PT5M}")
	void refresh() {
		try {
			statsCache.refreshOverallRanks();
		}
		catch (RuntimeException ex) {
			// the cached scores stay until they expire, then requests compute their own
			log.warn("Could not refresh the overall ranks", ex);
		}
	}

}
