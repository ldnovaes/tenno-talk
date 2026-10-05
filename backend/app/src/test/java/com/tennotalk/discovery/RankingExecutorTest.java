package com.tennotalk.discovery;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The hard timeout around the ranking: a stuck computation cannot hold a request. */
class RankingExecutorTest {

    private final ThreadPoolExecutor pool = new ThreadPoolExecutor(1, 1, 1, TimeUnit.SECONDS, new ArrayBlockingQueue<>(1));
    private final RankingExecutor executor = new RankingExecutor(pool);

    @AfterEach
    void stop() {
        executor.shutdownNow();
    }

    @Test
    void returnsTheResultInTime() {
        assertThat(executor.run(() -> "ranked", Duration.ofSeconds(1))).contains("ranked");
    }

    @Test
    void lateWorkIsAbandoned() {
        long started = System.nanoTime();
        assertThat(executor.run(() -> {
            while (!Thread.currentThread().isInterrupted()) Thread.onSpinWait(); // stuck until cancelled
            return "never";
        }, Duration.ofMillis(50))).isEmpty();
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(1));
    }

    @Test
    void failuresAndNullsAreEmpty() {
        assertThat(executor.run(() -> {
            throw new IllegalStateException("boom");
        }, Duration.ofSeconds(1))).isEmpty();
        assertThat(executor.run(() -> null, Duration.ofSeconds(1))).isEmpty();
    }

    @Test
    void aSaturatedPoolRejectsInsteadOfQueueingForever() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        Runnable block = () -> {
            try {
                release.await();
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        };
        pool.execute(block); // the only thread
        pool.execute(block); // the only queue slot
        assertThat(executor.run(() -> "late", Duration.ofSeconds(1))).isEmpty();
        release.countDown();
    }
}
