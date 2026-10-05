package com.tennotalk.recommender;

import java.time.Duration;

/**
 * Tunables of the frozen core. Out-of-range values are clamped, never rejected.
 *
 * @param budget             CPU time for the decorated ranking; above it the safe ranking is returned
 * @param exposureSlots      k: slots reserved for under-exposed posts in every block of {@code exposureBlock}
 * @param exposureBlock      n: block size (k of every n positions)
 * @param minImpressions     a post with fewer impressions than this is under-exposed…
 * @param exposureWindow     …while it is younger than this
 * @param freshnessHalfLife  the base score halves every half-life
 * @param contributionCap    largest absolute score a single signal may add
 * @param breakerThreshold   consecutive failing requests that open a signal's circuit
 * @param breakerCooldown    how long an open circuit keeps the signal off
 */
public record RecommenderConfig(Duration budget, int exposureSlots, int exposureBlock, int minImpressions,
        Duration exposureWindow, Duration freshnessHalfLife, double contributionCap, int breakerThreshold,
        Duration breakerCooldown) {

    public RecommenderConfig {
        budget = positive(budget, Duration.ofMillis(30));
        exposureBlock = Math.max(1, exposureBlock);
        exposureSlots = Math.clamp(exposureSlots, 0, exposureBlock - 1);
        minImpressions = Math.max(0, minImpressions);
        exposureWindow = positive(exposureWindow, Duration.ofHours(72));
        freshnessHalfLife = positive(freshnessHalfLife, Duration.ofHours(24));
        contributionCap = Double.isFinite(contributionCap) && contributionCap > 0 ? contributionCap : 10;
        breakerThreshold = Math.max(1, breakerThreshold);
        breakerCooldown = positive(breakerCooldown, Duration.ofMinutes(5));
    }

    public static RecommenderConfig defaults() {
        return new RecommenderConfig(Duration.ofMillis(30), 2, 10, 50, Duration.ofHours(72), Duration.ofHours(24), 10, 5,
                Duration.ofMinutes(5));
    }

    private static Duration positive(Duration value, Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }
}
