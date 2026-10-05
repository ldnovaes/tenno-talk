package com.tennotalk.recommender;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.tennotalk.recommender.signals.RankingWeights;
import com.tennotalk.recommender.signals.StandardRecommender;

/** Shared test data. Ids are small numbers so failures are readable: id(7) prints as 0…0-7. */
public final class Fixtures {

    public static final Instant NOW = Instant.parse("2026-10-05T12:00:00Z");
    public static final UUID VIEWER = id(1_000_000);

    private Fixtures() {}

    public static UUID id(int n) {
        return new UUID(0, n);
    }

    /** A budget no test machine exceeds, so properties are about the ranking and not about CPU speed. */
    public static RecommenderConfig roomy() {
        RecommenderConfig d = RecommenderConfig.defaults();
        return new RecommenderConfig(Duration.ofSeconds(30), d.exposureSlots(), d.exposureBlock(), d.minImpressions(),
                d.exposureWindow(), d.freshnessHalfLife(), d.contributionCap(), d.breakerThreshold(), d.breakerCooldown());
    }

    public static RecommenderConfig withExposure(RecommenderConfig base, int slots, int block, int minImpressions) {
        return new RecommenderConfig(base.budget(), slots, block, minImpressions, base.exposureWindow(), base.freshnessHalfLife(),
                base.contributionCap(), base.breakerThreshold(), base.breakerCooldown());
    }

    public static RecommenderConfig withoutExposure(RecommenderConfig base) {
        return withExposure(base, 0, base.exposureBlock(), base.minImpressions());
    }

    public static Recommender standard() {
        return StandardRecommender.create(RankingWeights.defaults(), roomy());
    }

    public static Recommender core() {
        return Recommender.builder().config(roomy()).build();
    }

    /** A well-exposed post (so the exposure floor leaves it alone) by {@code author}, one hour old. */
    public static Candidate post(int post, int author) {
        return post(post, author, Duration.ofHours(1), 1_000);
    }

    public static Candidate post(int post, int author, Duration age, long impressions) {
        return Candidate.builder(id(post), id(author))
                .createdAt(NOW.minus(age))
                .stats(new PostStats(impressions, 0, 0, 0, 0, 0))
                .build();
    }

    public static Candidate.Builder postBuilder(int post, int author) {
        return Candidate.builder(id(post), id(author)).createdAt(NOW.minus(Duration.ofHours(1)))
                .stats(new PostStats(1_000, 0, 0, 0, 0, 0));
    }

    public static Viewer viewer() {
        return Viewer.anonymous(VIEWER);
    }

    public static RankRequest request(Viewer viewer, List<Candidate> candidates, int limit) {
        return new RankRequest(viewer, candidates, limit, 42, NOW);
    }

    public static RankRequest request(List<Candidate> candidates) {
        return request(viewer(), candidates, Math.max(1, candidates.size()));
    }

    /** {@code count} well-exposed posts, each by a different author, with ages 1 h, 2 h, … */
    public static List<Candidate> posts(int count) {
        List<Candidate> posts = new ArrayList<>();
        for (int i = 1; i <= count; i++) posts.add(post(i, 10_000 + i, Duration.ofHours(i), 1_000));
        return posts;
    }

    /** What the core must keep: first occurrence of each id, minus the viewer's own, hidden posts and hidden authors. */
    public static Set<UUID> eligible(RankRequest request) {
        Map<UUID, Candidate> first = new LinkedHashMap<>();
        for (Candidate candidate : request.candidates()) {
            if (candidate == null || candidate.postId() == null || candidate.authorId() == null) continue;
            first.putIfAbsent(candidate.postId(), candidate);
        }
        Set<UUID> result = new HashSet<>();
        Viewer viewer = request.viewer();
        for (Candidate candidate : first.values()) {
            if (candidate.authorId().equals(viewer.id())) continue;
            if (viewer.hiddenPosts().contains(candidate.postId()) || viewer.hiddenAuthors().contains(candidate.authorId())) continue;
            result.add(candidate.postId());
        }
        return result;
    }
}
