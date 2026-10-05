package com.tennotalk.recommender;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.LongSupplier;

/**
 * Entry point of the discover ranking (PLAN.md §37). The pipeline is fixed:
 * Sanitize → HardFilter → freshness + score decorators → sort → rerank decorators → ExposureFloor → InvariantCheck.
 *
 * <p>{@link #rank} is total: it never throws. Anything that goes wrong falls back to the safe ranking
 * (freshness + exposure floor, no decorators), and if even that fails, to newest-first. Thread-safe.
 */
public final class Recommender {

    private final RecommenderConfig config;
    private final LongSupplier ticker;
    private final Freshness freshness;
    private final Scorer scorer;
    private final Reranker reranker;
    private final List<String> scoreSignals;
    private final List<String> signals;
    private final ExposureFloor exposure;
    private final CircuitBreakers breakers;

    private Recommender(Builder builder, Freshness freshness, Scorer scorer, Reranker reranker, List<String> scoreSignals,
            List<String> signals) {
        this.config = builder.config;
        this.ticker = builder.ticker;
        this.freshness = freshness;
        this.scorer = scorer;
        this.reranker = reranker;
        this.scoreSignals = scoreSignals;
        this.signals = signals;
        this.exposure = new ExposureFloor(config);
        this.breakers = new CircuitBreakers(config.breakerThreshold(), config.breakerCooldown());
    }

    public static Builder builder() {
        return new Builder();
    }

    /** Signal names in the order they run: score decorators (innermost first), then rerankers. */
    public List<String> signals() {
        return signals;
    }

    public RecommenderConfig config() {
        return config;
    }

    public Ranking rank(RankRequest request) {
        long started = safeTick();
        RankRequest safe = request == null ? new RankRequest(null, null, 0, 0, null) : request;
        try {
            return decorated(safe, started);
        } catch (Throwable failure) {
            return safeRanking(safe, started, "error:" + failure.getClass().getSimpleName(), Map.of(), Set.of(), Set.of());
        }
    }

    // ---- decorated path ---------------------------------------------------

    private Ranking decorated(RankRequest request, long started) {
        List<Candidate> eligible = HardFilter.apply(request.viewer(), Sanitize.apply(request.candidates()));
        Set<String> disabled = breakers.open(request.now());
        RankContext context = new RankContext(request.viewer(), request.now(), request.seed(), config.contributionCap(),
                ticker, signals, disabled);

        double[] base = new double[eligible.size()];
        double[][] contributions = new double[eligible.size()][];
        for (int i = 0; i < eligible.size(); i++) {
            Candidate candidate = eligible.get(i);
            context.beginCandidate();
            base[i] = freshness.score(context, candidate);
            scorer.score(context, candidate); // decorators record their contributions in the context
            contributions[i] = context.contributions();
        }

        Set<String> slow = slowSignals(context);
        Map<String, Integer> failures = context.failures();
        if (elapsed(started) > config.budget().toNanos()) {
            recordBreakers(context, failures, slow, request.now());
            return safeRanking(request, started, "budget", failures, slow, disabled);
        }

        // A signal that failed on any candidate is dropped for the whole request, so every post is judged alike.
        Set<String> dropped = new HashSet<>(failures.keySet());
        List<Ranked> ranked = new ArrayList<>(eligible.size());
        for (int i = 0; i < eligible.size(); i++) {
            ranked.add(scored(eligible.get(i), base[i], contributions[i], context, dropped, request.explain()));
        }
        ranked.sort(Ordering.BY_SCORE);

        List<Ranked> reranked = reranker.rerank(context, ranked);
        failures = context.failures();
        slow = slowSignals(context);
        recordBreakers(context, failures, slow, request.now());

        List<Ranked> output = truncate(exposure.apply(reranked, request.now()), request.limit());
        if (!InvariantCheck.holds(eligible, output, request.limit())) {
            return safeRanking(request, started, "invariant", failures, slow, disabled);
        }
        Diagnostics diagnostics = new Diagnostics(request.candidates().size(), eligible.size(), failures, slow, disabled, "",
                exposureCount(output), elapsed(started));
        return new Ranking(output, diagnostics);
    }

    private Ranked scored(Candidate candidate, double base, double[] contributions, RankContext context, Set<String> dropped,
            boolean explain) {
        double score = base;
        Map<String, Double> explained = explain ? new HashMap<>() : null;
        if (explained != null) explained.put("freshness", base);
        for (String signal : scoreSignals) {
            if (dropped.contains(signal)) continue;
            double delta = contributions[context.slot(signal)];
            score += delta;
            if (explained != null && delta != 0) explained.put(signal, delta);
        }
        if (!Double.isFinite(score)) score = base;
        return new Ranked(candidate, score, false, explained);
    }

    private Set<String> slowSignals(RankContext context) {
        long limit = config.budget().toNanos() / 2;
        Set<String> slow = new HashSet<>();
        for (String signal : signals) if (context.nanos(signal) > limit) slow.add(signal);
        return slow;
    }

    private void recordBreakers(RankContext context, Map<String, Integer> failures, Set<String> slow, Instant now) {
        for (String signal : signals) {
            if (context.disabled().contains(signal)) continue;
            breakers.record(signal, failures.containsKey(signal) || slow.contains(signal), now);
        }
    }

    // ---- safe path ----------------------------------------------------------

    /** Freshness + exposure floor, no decorators. If this fails too, newest-first. */
    private Ranking safeRanking(RankRequest request, long started, String reason, Map<String, Integer> failures, Set<String> slow,
            Set<String> disabled) {
        try {
            List<Candidate> eligible = HardFilter.apply(request.viewer(), Sanitize.apply(request.candidates()));
            RankContext context = new RankContext(request.viewer(), request.now(), request.seed(), config.contributionCap(),
                    () -> 0L, List.of(), Set.of());
            List<Ranked> ranked = new ArrayList<>(eligible.size());
            for (Candidate candidate : eligible) ranked.add(new Ranked(candidate, freshness.score(context, candidate), false, null));
            ranked.sort(Ordering.BY_SCORE);
            List<Ranked> output = truncate(exposure.apply(ranked, request.now()), request.limit());
            if (!InvariantCheck.holds(eligible, output, request.limit())) throw new IllegalStateException("safe ranking invariant");
            return new Ranking(output, new Diagnostics(request.candidates().size(), eligible.size(), failures, slow, disabled, reason,
                    exposureCount(output), elapsed(started)));
        } catch (Throwable failure) {
            return newestFirst(request, started, reason + "+newest");
        }
    }

    /** Last resort: the simplest possible ordering of whatever has ids. Never throws. */
    Ranking newestFirst(RankRequest request, long started, String reason) {
        try {
            Viewer viewer = request.viewer();
            Map<UUID, Candidate> unique = new java.util.LinkedHashMap<>();
            for (Candidate candidate : request.candidates()) {
                if (candidate == null || candidate.postId() == null || candidate.authorId() == null) continue;
                unique.putIfAbsent(candidate.postId(), candidate);
            }
            List<Candidate> eligible = new ArrayList<>();
            for (Candidate candidate : unique.values()) {
                if (Objects.equals(candidate.authorId(), viewer.id())) continue;
                if (viewer.hiddenPosts().contains(candidate.postId()) || viewer.hiddenAuthors().contains(candidate.authorId())) continue;
                eligible.add(candidate);
            }
            eligible.sort(Comparator.comparing(Candidate::createdAt).reversed().thenComparing(Candidate::postId));
            List<Ranked> output = new ArrayList<>();
            for (Candidate candidate : eligible.subList(0, Math.min(request.limit(), eligible.size()))) {
                output.add(new Ranked(candidate, 0, false, null));
            }
            return new Ranking(output, new Diagnostics(request.candidates().size(), eligible.size(), Map.of(), Set.of(), Set.of(),
                    reason, 0, elapsed(started)));
        } catch (Throwable failure) {
            return new Ranking(List.of(), new Diagnostics(0, 0, Map.of(), Set.of(), Set.of(), reason + "+empty", 0, 0));
        }
    }

    // ---- helpers ------------------------------------------------------------

    private static List<Ranked> truncate(List<Ranked> ranked, int limit) {
        return ranked.size() <= limit ? ranked : ranked.subList(0, limit);
    }

    private static int exposureCount(List<Ranked> output) {
        int count = 0;
        for (Ranked ranked : output) if (ranked.exposure()) count++;
        return count;
    }

    private long safeTick() {
        try {
            return ticker.getAsLong();
        } catch (Throwable failure) {
            return 0;
        }
    }

    private long elapsed(long started) {
        return Math.max(0, safeTick() - started);
    }

    // ---- builder ------------------------------------------------------------

    /**
     * Assembles the pipeline. Configuration errors (a factory that throws or returns null, repeated
     * signal names) fail here, at startup, never during {@link #rank}.
     */
    public static final class Builder {

        private RecommenderConfig config = RecommenderConfig.defaults();
        private LongSupplier ticker = System::nanoTime;
        private final List<Function<Scorer, ? extends ScoreDecorator>> scoreDecorators = new ArrayList<>();
        private final List<Function<Reranker, ? extends RerankDecorator>> rerankDecorators = new ArrayList<>();

        private Builder() {}

        public Builder config(RecommenderConfig value) {
            config = Objects.requireNonNull(value, "config");
            return this;
        }

        /** Monotonic nanoseconds; tests replace it to simulate slow signals. */
        public Builder ticker(LongSupplier value) {
            ticker = Objects.requireNonNull(value, "ticker");
            return this;
        }

        /** Wraps the scorer built so far; the first one added sits right above freshness. */
        public Builder score(Function<Scorer, ? extends ScoreDecorator> decorator) {
            scoreDecorators.add(Objects.requireNonNull(decorator, "decorator"));
            return this;
        }

        /** Wraps the reranker built so far; the first one added runs first. */
        public Builder rerank(Function<Reranker, ? extends RerankDecorator> decorator) {
            rerankDecorators.add(Objects.requireNonNull(decorator, "decorator"));
            return this;
        }

        public Recommender build() {
            Set<String> names = new LinkedHashSet<>();
            List<String> scoreNames = new ArrayList<>();
            Freshness freshness = new Freshness(config.freshnessHalfLife());
            Scorer scorer = freshness;
            for (Function<Scorer, ? extends ScoreDecorator> factory : scoreDecorators) {
                ScoreDecorator decorator = Objects.requireNonNull(factory.apply(scorer), "score decorator factory returned null");
                if (!names.add(decorator.name())) throw new IllegalStateException("Repeated signal name: " + decorator.name());
                scoreNames.add(decorator.name());
                scorer = decorator;
            }
            Reranker reranker = Reranker.IDENTITY;
            for (Function<Reranker, ? extends RerankDecorator> factory : rerankDecorators) {
                RerankDecorator decorator = Objects.requireNonNull(factory.apply(reranker), "rerank decorator factory returned null");
                if (!names.add(decorator.name())) throw new IllegalStateException("Repeated signal name: " + decorator.name());
                reranker = decorator;
            }
            if (names.contains("freshness")) throw new IllegalStateException("\"freshness\" is the core's base score");
            return new Recommender(this, freshness, scorer, reranker, List.copyOf(scoreNames),
                    List.copyOf(names));
        }
    }
}
