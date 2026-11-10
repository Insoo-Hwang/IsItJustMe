package com.isitjustme.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.isitjustme.category.CategoryStatsCache.OverallRanks;

class OverallRanksHolderTests {

	private final CategoryStatsCache statsCache = mock(CategoryStatsCache.class);

	private final OverallRanksHolder holder = new OverallRanksHolder(statsCache);

	@Test
	void requestsBeforeTheFirstTableLoadItOnce() throws Exception {
		OverallRanks ranks = ranks(3);
		given(statsCache.overallRanks()).willAnswer((invocation) -> {
			Thread.sleep(200);
			return ranks;
		});
		int requests = 30;
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(requests);
		try {
			List<Future<OverallRanks>> results = new ArrayList<>();
			for (int i = 0; i < requests; i++) {
				results.add(pool.submit(() -> {
					start.await();
					return holder.current();
				}));
			}
			start.countDown();
			for (Future<OverallRanks> result : results) {
				assertThat(result.get(5, TimeUnit.SECONDS)).isSameAs(ranks);
			}
		}
		finally {
			pool.shutdownNow();
		}

		then(statsCache).should(times(1)).overallRanks();
	}

	@Test
	void refreshReplacesTheTableWithoutLoading() {
		OverallRanks first = ranks(1);
		OverallRanks second = ranks(2);
		given(statsCache.refreshOverallRanks()).willReturn(first, second);

		holder.refresh();
		assertThat(holder.current()).isSameAs(first);
		holder.refresh();
		assertThat(holder.current()).isSameAs(second);

		then(statsCache).should(times(0)).overallRanks();
	}

	@Test
	void aFailedRefreshKeepsTheLastTable() {
		OverallRanks kept = ranks(1);
		given(statsCache.refreshOverallRanks()).willReturn(kept);
		holder.refresh();
		willThrow(new IllegalStateException("database down")).given(statsCache).refreshOverallRanks();

		holder.refresh();

		assertThat(holder.current()).isSameAs(kept);
	}

	@Test
	void firstRequestWaitsForTheStartupRefresh() throws Exception {
		OverallRanks ranks = ranks(3);
		CountDownLatch refreshing = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		given(statsCache.refreshOverallRanks()).willAnswer((invocation) -> {
			refreshing.countDown();
			assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
			return ranks;
		});
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			Future<?> refresh = pool.submit(holder::refresh);
			assertThat(refreshing.await(5, TimeUnit.SECONDS)).isTrue();
			Future<OverallRanks> request = pool.submit(holder::current);
			release.countDown();
			refresh.get(5, TimeUnit.SECONDS);
			assertThat(request.get(5, TimeUnit.SECONDS)).isSameAs(ranks);
			then(statsCache).should(times(0)).overallRanks();
		}
		finally {
			release.countDown();
			pool.shutdownNow();
		}
	}

	@Test
	void readsTheLastTableWhileRefreshIsRunning() throws Exception {
		OverallRanks first = ranks(1);
		OverallRanks second = ranks(2);
		given(statsCache.overallRanks()).willReturn(first);
		holder.current();
		CountDownLatch refreshing = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		given(statsCache.refreshOverallRanks()).willAnswer((invocation) -> {
			refreshing.countDown();
			assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
			return second;
		});
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			Future<?> refresh = pool.submit(holder::refresh);
			assertThat(refreshing.await(5, TimeUnit.SECONDS)).isTrue();
			assertThat(pool.submit(holder::current).get(2, TimeUnit.SECONDS)).isSameAs(first);
			release.countDown();
			refresh.get(5, TimeUnit.SECONDS);
			assertThat(holder.current()).isSameAs(second);
		}
		finally {
			release.countDown();
			pool.shutdownNow();
		}
	}

	private static OverallRanks ranks(long participants) {
		return new OverallRanks(Instant.now(), participants, new long[60], 1, new long[0]);
	}

}
