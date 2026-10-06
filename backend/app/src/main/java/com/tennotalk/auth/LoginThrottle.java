package com.tennotalk.auth;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.tennotalk.common.ApiException;
import com.tennotalk.common.ErrorCode;

import io.github.bucket4j.Bucket;

/**
 * Failed sign-ins per account (PLAN.md §38), on top of the per-IP limit: guessing one person's password from many
 * addresses stops after {@link #FAILURES} misses in {@link #WINDOW}. The answer never says whether the account exists.
 */
@Component
public class LoginThrottle {

    static final int FAILURES = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Bucket> failures = new ConcurrentHashMap<>();

    /** Refuses (429) an email that already failed too often, before the password is even checked. */
    public void requireAllowed(String normalizedEmail) {
        Bucket bucket = failures.get(normalizedEmail);
        if (bucket != null && bucket.getAvailableTokens() <= 0) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many attempts. Try again in a few minutes.");
        }
    }

    public void failed(String normalizedEmail) {
        failures.computeIfAbsent(normalizedEmail, key -> Bucket.builder()
                .addLimit(limit -> limit.capacity(FAILURES).refillGreedy(FAILURES, WINDOW)).build()).tryConsume(1);
    }

    /** Full buckets carry no information; dropping them keeps memory bounded. */
    @Scheduled(fixedDelayString = "PT15M")
    void evictIdle() {
        failures.values().removeIf(bucket -> bucket.getAvailableTokens() >= FAILURES);
    }

    /** Test hook: start without failures. */
    public void reset() {
        failures.clear();
    }
}
