package com.tennotalk.recommender;

import java.util.Map;
import java.util.Set;

/**
 * What happened during a ranking call, for logs and metrics.
 *
 * @param received      candidates in the request
 * @param eligible      candidates left after Sanitize and HardFilter
 * @param failures      signal name → candidates on which it threw or returned an invalid value
 * @param slow          signals that used more than half of the time budget
 * @param disabled      signals skipped because their circuit breaker is open
 * @param fallback      why the safe ranking was used instead ("" when it was not)
 * @param exposureSlots posts placed in slots reserved for under-exposed posts
 */
public record Diagnostics(int received, int eligible, Map<String, Integer> failures, Set<String> slow,
        Set<String> disabled, String fallback, int exposureSlots, long elapsedNanos) {

    public Diagnostics {
        failures = failures == null ? Map.of() : Map.copyOf(failures);
        slow = slow == null ? Set.of() : Set.copyOf(slow);
        disabled = disabled == null ? Set.of() : Set.copyOf(disabled);
        fallback = fallback == null ? "" : fallback;
    }

    public boolean usedFallback() {
        return !fallback.isEmpty();
    }
}
