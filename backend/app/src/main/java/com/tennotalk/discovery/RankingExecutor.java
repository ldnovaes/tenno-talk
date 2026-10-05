package com.tennotalk.discovery;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/** Runs a computation on a bounded pool with a timeout; empty when it is late, rejected or failed. */
class RankingExecutor {

    private final ExecutorService pool;

    RankingExecutor(ExecutorService pool) {
        this.pool = pool;
    }

    <T> Optional<T> run(Supplier<T> work, Duration timeout) {
        Future<T> future;
        try {
            future = pool.submit(work::get);
        } catch (RuntimeException rejected) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(future.get(timeout.toMillis(), TimeUnit.MILLISECONDS));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            future.cancel(true);
            return Optional.empty();
        } catch (Exception lateOrFailed) {
            future.cancel(true);
            return Optional.empty();
        }
    }

    void shutdownNow() {
        pool.shutdownNow();
    }
}
