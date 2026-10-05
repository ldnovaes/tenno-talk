package com.tennotalk.recommender;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

/** Builds {@link RankContext}s for decorator tests outside the core package. */
public final class Contexts {

    private Contexts() {}

    public static RankContext of(Viewer viewer, List<String> signals) {
        AtomicLong clock = new AtomicLong();
        return new RankContext(viewer, Fixtures.NOW, 42, RecommenderConfig.defaults().contributionCap(), clock::incrementAndGet,
                signals, Set.of());
    }

    public static RankContext disabled(Viewer viewer, List<String> signals) {
        return new RankContext(viewer, Fixtures.NOW, 42, RecommenderConfig.defaults().contributionCap(), () -> 0L, signals,
                Set.copyOf(signals));
    }

    public static Map<String, Integer> failures(RankContext context) {
        return context.failures();
    }

    public static double cap() {
        return RecommenderConfig.defaults().contributionCap();
    }
}
