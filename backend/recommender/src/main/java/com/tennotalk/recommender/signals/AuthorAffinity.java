package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/** Accumulated affinity with the author: likes, comments, visible time, profile visits, conversations. */
public final class AuthorAffinity extends ScoreDecorator {

    private final double weight;

    public AuthorAffinity(Scorer inner, double weight) {
        super(inner, "author-affinity");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        return weight * Signals.squash(context.viewer().authorAffinity(candidate.authorId()));
    }
}
