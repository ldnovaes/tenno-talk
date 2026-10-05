package com.tennotalk.recommender;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;

/** Misbehaving decorators for chaos tests. */
public final class Saboteurs {

    private Saboteurs() {}

    /** Adds {@code value} to every candidate, or throws what {@code failure} supplies when {@code when} matches. */
    public static final class Throwing extends ScoreDecorator {
        private final Predicate<Candidate> when;
        private final Supplier<? extends RuntimeException> failure;
        private final Supplier<? extends Error> error;

        public Throwing(Scorer inner, String name, Predicate<Candidate> when, Supplier<? extends RuntimeException> failure) {
            super(inner, name);
            this.when = when;
            this.failure = failure;
            this.error = null;
        }

        private Throwing(Scorer inner, String name, Predicate<Candidate> when, Supplier<? extends Error> error, boolean marker) {
            super(inner, name);
            this.when = when;
            this.failure = null;
            this.error = error;
        }

        public static Throwing error(Scorer inner, String name, Supplier<? extends Error> error) {
            return new Throwing(inner, name, candidate -> true, error, true);
        }

        @Override
        protected double adjust(RankContext context, Candidate candidate, double innerScore) {
            if (when.test(candidate)) {
                if (error != null) throw error.get();
                throw failure.get();
            }
            return 0.5;
        }
    }

    /** Returns a fixed value for every candidate (NaN, ∞, above the cap…). */
    public static final class Constant extends ScoreDecorator {
        private final double value;

        public Constant(Scorer inner, String name, double value) {
            super(inner, name);
            this.value = value;
        }

        @Override
        protected double adjust(RankContext context, Candidate candidate, double innerScore) {
            return value;
        }
    }

    /** Spends {@code nanos} of the fake clock per candidate. */
    public static final class Slow extends ScoreDecorator {
        private final FakeTicker ticker;
        private final long nanos;

        public Slow(Scorer inner, String name, FakeTicker ticker, long nanos) {
            super(inner, name);
            this.ticker = ticker;
            this.nanos = nanos;
        }

        @Override
        protected double adjust(RankContext context, Candidate candidate, double innerScore) {
            ticker.advance(nanos);
            return 0.1;
        }
    }

    /** A reranker that returns whatever {@code reorder} makes of the list. */
    public static final class Rogue extends RerankDecorator {
        private final Function<List<Ranked>, List<Ranked>> reorder;

        public Rogue(Reranker inner, String name, Function<List<Ranked>, List<Ranked>> reorder) {
            super(inner, name);
            this.reorder = reorder;
        }

        @Override
        protected List<Ranked> reorder(RankContext context, List<Ranked> ranked) {
            return reorder.apply(new ArrayList<>(ranked));
        }
    }

    /** A clock the test moves by hand. */
    public static final class FakeTicker implements java.util.function.LongSupplier {
        private long now;

        public void advance(long nanos) {
            now += nanos;
        }

        @Override
        public long getAsLong() {
            return now;
        }
    }
}
