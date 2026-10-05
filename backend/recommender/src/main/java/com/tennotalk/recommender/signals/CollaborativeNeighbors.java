package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/** People with interests like the viewer's engaged with this post (collaborative filtering). */
public final class CollaborativeNeighbors extends ScoreDecorator {

    private final double weight;

    public CollaborativeNeighbors(Scorer inner, double weight) {
        super(inner, "collaborative-neighbors");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        return weight * Signals.squash(context.viewer().neighborEngagement(candidate.postId()));
    }
}
