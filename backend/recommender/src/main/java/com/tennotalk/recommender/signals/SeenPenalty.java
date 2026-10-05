package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/** Already shown in an earlier session: still allowed (nothing is lost), but behind what is new to the viewer. */
public final class SeenPenalty extends ScoreDecorator {

    private final double weight;

    public SeenPenalty(Scorer inner, double weight) {
        super(inner, "seen-penalty");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        return context.viewer().seen().contains(candidate.postId()) ? -weight : 0;
    }
}
