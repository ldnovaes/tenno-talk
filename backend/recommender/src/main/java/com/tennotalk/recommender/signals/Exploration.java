package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/**
 * Keeps the feed from collapsing onto what is already known: an optimism bonus for posts with few
 * impressions (UCB-like) plus noise seeded per session, so two sessions never look identical.
 */
public final class Exploration extends ScoreDecorator {

    private final double weight;

    public Exploration(Scorer inner, double weight) {
        super(inner, "exploration");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        double optimism = 1 / Math.sqrt(1.0 + candidate.stats().impressions());
        return weight * (0.7 * optimism + 0.3 * context.noise(candidate.postId()));
    }
}
