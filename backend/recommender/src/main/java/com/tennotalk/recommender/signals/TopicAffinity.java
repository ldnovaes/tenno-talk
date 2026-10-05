package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/** How close the post's topics and hashtags are to what the viewer engages with (cosine, so hides pull it down). */
public final class TopicAffinity extends ScoreDecorator {

    private final double weight;

    public TopicAffinity(Scorer inner, double weight) {
        super(inner, "topic-affinity");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        return weight * context.viewer().topics().cosine(candidate.topics());
    }
}
