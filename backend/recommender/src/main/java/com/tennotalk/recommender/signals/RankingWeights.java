package com.tennotalk.recommender.signals;

/**
 * Weights of the v1 signals (PLAN.md §37.4), relative to freshness (which is worth at most 1).
 * Negative or non-finite weights become 0 (the signal is off). Penalties are weights too: the signal is negative.
 */
public record RankingWeights(double topic, double author, double language, double social, double country,
        double engagement, double neighbors, double exploration, double negative, double seen,
        int authorGap, double diversity) {

    public RankingWeights {
        topic = weight(topic);
        author = weight(author);
        language = weight(language);
        social = weight(social);
        country = weight(country);
        engagement = weight(engagement);
        neighbors = weight(neighbors);
        exploration = weight(exploration);
        negative = weight(negative);
        seen = weight(seen);
        authorGap = Math.clamp(authorGap, 1, 50);
        diversity = weight(diversity);
    }

    public static RankingWeights defaults() {
        return new RankingWeights(3.0, 2.0, 1.5, 1.5, 0.5, 1.0, 1.5, 0.5, 3.0, 2.0, 4, 0.5);
    }

    private static double weight(double value) {
        return Double.isFinite(value) && value > 0 ? Math.min(value, 1_000) : 0;
    }
}
