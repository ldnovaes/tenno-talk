package com.tennotalk.recommender;

/** Scores one candidate. The core's base scorer is freshness; signals are {@link ScoreDecorator}s around it. */
@FunctionalInterface
public interface Scorer {

    Scorer ZERO = (context, candidate) -> 0;

    double score(RankContext context, Candidate candidate);
}
