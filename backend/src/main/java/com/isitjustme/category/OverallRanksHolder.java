package com.isitjustme.category;

import org.jspecify.annotations.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.isitjustme.category.CategoryStatsCache.OverallRanks;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * The rank table every request reads, kept in this server's memory so requests reuse
 * the last completed table. It is filled right after startup and replaced every few minutes;
 * Redis only lets a server start from the table another one made. A request that comes
 * before the first table waits for a single load instead of each scoring everyone, and
 * when Redis is down the last table keeps serving.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OverallRanksHolder {

	private final CategoryStatsCache statsCache;

	private volatile @Nullable OverallRanks latest;

	OverallRanks current() {
		OverallRanks ranks = latest;
		if (ranks != null) {
			return ranks;
		}
		synchronized (this) {
			if (latest == null) {
				// the shared table if there is one; otherwise scored here, once
				latest = statsCache.overallRanks();
			}
			return latest;
		}
	}

	@Scheduled(initialDelayString = "${overall.ranks.initial-delay:PT0S}",
			fixedDelayString = "${overall.ranks.refresh:PT5M}")
	synchronized void refresh() {
		try {
			latest = statsCache.refreshOverallRanks();
		}
		catch (RuntimeException ex) {
			// the table in memory stays until the next refresh works
			log.warn("Could not refresh the overall ranks", ex);
		}
	}

}
