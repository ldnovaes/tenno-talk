package com.tennotalk.discovery;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

import com.tennotalk.recommender.RecommenderConfig;
import com.tennotalk.recommender.signals.RankingWeights;

/**
 * Discover configuration under {@code tenno.discover} (PLAN.md §37). Missing or invalid values fall back to the
 * defaults below, so a typo never takes Discover down.
 *
 * @param pageSize        posts per page
 * @param sessionSize     posts kept in a ranked session snapshot
 * @param candidateLimit  candidates ranked per session (all sources together)
 * @param sourceLimit     candidates each source may contribute
 * @param window          only posts younger than this are candidates
 * @param sessionTtl      a snapshot expires after this
 * @param rankTimeout     hard limit for the ranking call; above it the newest-first order is used
 * @param queryTimeout    statement timeout of the discover read queries (whole seconds, at least 1)
 * @param affinityHalfLife learned interests halve every half-life
 * @param eventRetention  processed interaction events are deleted after this
 * @param workerEnabled   process interaction events in the background (tests call the workers directly)
 * @param workerBatch     events folded per worker transaction
 */
@ConfigurationProperties(prefix = "tenno.discover")
public record DiscoverProperties(int pageSize, int sessionSize, int candidateLimit, int sourceLimit, Duration window,
        Duration sessionTtl, Duration rankTimeout, Duration queryTimeout, Duration affinityHalfLife, Duration eventRetention,
        boolean workerEnabled, int workerBatch, Ranking ranking, Weights weights) {

    /** Tunables of the frozen core (RecommenderConfig). */
    public record Ranking(Duration budget, int exposureSlots, int exposureBlock, int minImpressions, Duration exposureWindow,
            Duration freshnessHalfLife, double contributionCap, int breakerThreshold, Duration breakerCooldown) {}

    /** Weights of the v1 signals (RankingWeights). */
    public record Weights(double topic, double author, double language, double social, double country, double engagement,
            double neighbors, double exploration, double negative, double seen, int authorGap, double diversity) {}

    public DiscoverProperties {
        pageSize = pageSize > 0 ? Math.min(pageSize, 50) : 10;
        sessionSize = sessionSize > 0 ? sessionSize : 300;
        candidateLimit = candidateLimit > 0 ? candidateLimit : 500;
        sourceLimit = sourceLimit > 0 ? sourceLimit : 120;
        window = positive(window, Duration.ofDays(14));
        sessionTtl = positive(sessionTtl, Duration.ofMinutes(30));
        rankTimeout = positive(rankTimeout, Duration.ofMillis(250));
        queryTimeout = positive(queryTimeout, Duration.ofSeconds(2));
        affinityHalfLife = positive(affinityHalfLife, Duration.ofDays(14));
        eventRetention = positive(eventRetention, Duration.ofDays(90));
        workerBatch = workerBatch > 0 ? workerBatch : 500;
    }

    public RecommenderConfig recommenderConfig() {
        if (ranking == null) return RecommenderConfig.defaults();
        return new RecommenderConfig(ranking.budget(), ranking.exposureSlots(), ranking.exposureBlock(), ranking.minImpressions(),
                ranking.exposureWindow(), ranking.freshnessHalfLife(), ranking.contributionCap(), ranking.breakerThreshold(),
                ranking.breakerCooldown());
    }

    public RankingWeights rankingWeights() {
        if (weights == null) return RankingWeights.defaults();
        return new RankingWeights(weights.topic(), weights.author(), weights.language(), weights.social(), weights.country(),
                weights.engagement(), weights.neighbors(), weights.exploration(), weights.negative(), weights.seen(),
                weights.authorGap(), weights.diversity());
    }

    private static Duration positive(Duration value, Duration fallback) {
        return value == null || value.isNegative() || value.isZero() ? fallback : value;
    }
}
