package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;
import com.tennotalk.recommender.Viewer;

/** Closeness in the social graph: followed, chatted with, or followed by someone the viewer follows. */
public final class SocialProximity extends ScoreDecorator {

    static final double FOLLOWING = 1.0;
    static final double CHAT_PARTNER = 0.8;
    static final double SECOND_DEGREE = 0.4;

    private final double weight;

    public SocialProximity(Scorer inner, double weight) {
        super(inner, "social-proximity");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        Viewer viewer = context.viewer();
        if (viewer.following().contains(candidate.authorId())) return weight * FOLLOWING;
        if (viewer.chatPartners().contains(candidate.authorId())) return weight * CHAT_PARTNER;
        if (viewer.secondDegree().contains(candidate.authorId())) return weight * SECOND_DEGREE;
        return 0;
    }
}
