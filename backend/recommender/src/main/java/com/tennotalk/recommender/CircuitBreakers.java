package com.tennotalk.recommender;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Turns a misbehaving signal off for a while: after {@code threshold} consecutive failing requests the
 * circuit opens for {@code cooldown}. The first request after the cooldown is a trial: one more failure
 * reopens it at once; a success closes it. Thread-safe; time comes from the requests, so tests control it.
 */
final class CircuitBreakers {

    private record State(int consecutiveFailures, Instant openUntil, boolean onTrial) {
        static final State CLOSED = new State(0, Instant.MIN, false);
    }

    private final int threshold;
    private final Duration cooldown;
    private final Map<String, State> states = new ConcurrentHashMap<>();

    CircuitBreakers(int threshold, Duration cooldown) {
        this.threshold = threshold;
        this.cooldown = cooldown;
    }

    Set<String> open(Instant now) {
        Set<String> open = new HashSet<>();
        states.forEach((signal, state) -> {
            if (now.isBefore(state.openUntil())) open.add(signal);
        });
        return Set.copyOf(open);
    }

    void record(String signal, boolean failed, Instant now) {
        states.compute(signal, (key, current) -> {
            State state = current == null ? State.CLOSED : current;
            if (!failed) return State.CLOSED;
            int failures = state.consecutiveFailures() + 1;
            if (state.onTrial() || failures >= threshold) return new State(0, now.plus(cooldown), true);
            return new State(failures, state.openUntil(), false);
        });
    }
}
