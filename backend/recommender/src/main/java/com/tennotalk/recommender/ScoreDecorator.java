package com.tennotalk.recommender;

/**
 * The only way to add a ranking signal (PLAN.md §37.4). A decorator wraps the scorer below it and adds
 * {@link #adjust}. {@link #score} is final: it carries the safety envelope, so a signal that throws,
 * returns NaN/∞ or exceeds the contribution cap adds nothing, and the call is accounted for.
 * Implementations must be stateless and thread-safe; a contract test is mandatory.
 */
public abstract class ScoreDecorator implements Scorer {

    private final Scorer inner;
    private final String name;

    protected ScoreDecorator(Scorer inner, String name) {
        this.inner = inner == null ? Scorer.ZERO : inner;
        this.name = name == null || name.isBlank() ? getClass().getSimpleName() : name.strip();
    }

    /** Unique signal name, used in diagnostics, metrics and circuit breakers. */
    public final String name() {
        return name;
    }

    /**
     * Score added to the inner score. Should be additive and bounded by the weight; {@code innerScore}
     * is available for signals that scale the score below them.
     */
    protected abstract double adjust(RankContext context, Candidate candidate, double innerScore);

    @Override
    public final double score(RankContext context, Candidate candidate) {
        double base = inner.score(context, candidate);
        if (!context.enabled(name)) return base;
        long started = context.tick();
        double delta;
        try {
            delta = adjust(context, candidate, base);
        } catch (Throwable failure) {
            context.spent(name, context.tick() - started);
            context.failed(name);
            return base;
        }
        context.spent(name, context.tick() - started);
        if (!Double.isFinite(delta) || Math.abs(delta) > context.cap()) {
            context.failed(name);
            return base;
        }
        context.contribute(name, delta);
        return base + delta;
    }
}
