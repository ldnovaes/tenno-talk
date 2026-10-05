package com.tennotalk.recommender.signals;

import java.util.function.LongSupplier;

import com.tennotalk.recommender.Recommender;
import com.tennotalk.recommender.RecommenderConfig;

/**
 * The v1 discover ranking (PLAN.md §37.4): the frozen core plus every v1 signal. A new signal is a new
 * decorator added here, never a change to the core.
 */
public final class StandardRecommender {

    private StandardRecommender() {}

    public static Recommender create(RankingWeights weights, RecommenderConfig config) {
        return builder(weights, config).build();
    }

    public static Recommender create(RankingWeights weights, RecommenderConfig config, LongSupplier ticker) {
        return builder(weights, config).ticker(ticker).build();
    }

    /**
     * The v1 pipeline, open for tests and for experiments that add decorators on top.
     *
     * @throws IllegalArgumentException when a weight exceeds the contribution cap (the signal would always be refused)
     */
    public static Recommender.Builder builder(RankingWeights weights, RecommenderConfig config) {
        double[] all = {weights.topic(), weights.author(), weights.language(), weights.social(), weights.country(),
                weights.engagement(), weights.neighbors(), weights.exploration(), weights.negative(), weights.seen()};
        for (double weight : all) {
            if (weight > config.contributionCap()) {
                throw new IllegalArgumentException("Weight " + weight + " exceeds the contribution cap " + config.contributionCap());
            }
        }
        return Recommender.builder()
                .config(config)
                .score(inner -> new TopicAffinity(inner, weights.topic()))
                .score(inner -> new AuthorAffinity(inner, weights.author()))
                .score(inner -> new LanguageExchange(inner, weights.language()))
                .score(inner -> new SocialProximity(inner, weights.social()))
                .score(inner -> new CountryAffinity(inner, weights.country()))
                .score(inner -> new Engagement(inner, weights.engagement()))
                .score(inner -> new CollaborativeNeighbors(inner, weights.neighbors()))
                .score(inner -> new Exploration(inner, weights.exploration()))
                .score(inner -> new NegativeFeedback(inner, weights.negative()))
                .score(inner -> new SeenPenalty(inner, weights.seen()))
                .rerank(inner -> new TopicDiversity(inner, weights.diversity()))
                .rerank(inner -> new AuthorSpacing(inner, weights.authorGap()));
    }
}
