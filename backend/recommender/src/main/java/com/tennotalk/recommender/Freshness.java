package com.tennotalk.recommender;

import java.time.Duration;

/** Base score of the core: 1 for a post created now, halving every half-life. Total and in (0, 1]. */
final class Freshness implements Scorer {

    private final double halfLifeHours;

    Freshness(Duration halfLife) {
        this.halfLifeHours = halfLife.toMillis() / 3_600_000.0;
    }

    @Override
    public double score(RankContext context, Candidate candidate) {
        double ageHours = Math.max(0, (context.now().toEpochMilli() - candidate.createdAt().toEpochMilli()) / 3_600_000.0);
        double score = Math.pow(2, -ageHours / halfLifeHours);
        // Very old posts underflow to 0; keep them strictly positive and comparable by age.
        return Double.isFinite(score) && score > 0 ? score : Double.MIN_NORMAL;
    }
}
