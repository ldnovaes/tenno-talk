package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.PostStats;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/**
 * How well the post does with everyone, per impression. The rate is smoothed with a prior (Bayesian average),
 * so a post with 1 like in 1 impression does not beat one with 300 likes in 1 000.
 */
public final class Engagement extends ScoreDecorator {

    static final double PRIOR_IMPRESSIONS = 20;
    static final double PRIOR_RATE = 0.05;
    /** Average visible seconds that count as full attention. */
    static final double FULL_DWELL_SECONDS = 10;

    private final double weight;

    public Engagement(Scorer inner, double weight) {
        super(inner, "engagement");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        return weight * signal(candidate.stats());
    }

    /** In [0, 1]. */
    static double signal(PostStats stats) {
        double actions = stats.likes() + 2.0 * stats.comments() + 3.0 * stats.shares();
        double rate = (actions + PRIOR_IMPRESSIONS * PRIOR_RATE) / (stats.impressions() + PRIOR_IMPRESSIONS);
        double attention = Math.min(1, stats.averageDwellSeconds() / FULL_DWELL_SECONDS);
        return 0.7 * Signals.squash(rate / 0.2) + 0.3 * attention;
    }
}
