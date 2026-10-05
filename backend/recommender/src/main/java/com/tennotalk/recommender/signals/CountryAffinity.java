package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;

/** Learned affinity with the author's country (the viewer engages with posts from there). */
public final class CountryAffinity extends ScoreDecorator {

    private final double weight;

    public CountryAffinity(Scorer inner, double weight) {
        super(inner, "country-affinity");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        if (candidate.authorCountry().isEmpty()) return 0;
        return weight * Signals.squash(context.viewer().countries().get(candidate.authorCountry()));
    }
}
