package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.PostStats;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/** Posts that many people hide ("not interested") sink for everyone. Personal hides are hard filters. */
public final class NegativeFeedback extends ScoreDecorator {

    static final double PRIOR_IMPRESSIONS = 10;
    static final double SENSITIVITY = 5;

    private final double weight;

    public NegativeFeedback(Scorer inner, double weight) {
        super(inner, "negative-feedback");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        return -weight * signal(candidate.stats());
    }

    /** In [0, 1]. */
    static double signal(PostStats stats) {
        return Math.min(1, SENSITIVITY * stats.hides() / (stats.impressions() + PRIOR_IMPRESSIONS));
    }
}
