package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.UUID;

final class RankingAssertions {
    private RankingAssertions() {}

    static void valid(RankRequest request, Ranking ranking, RecommenderConfig config) {
        Set<UUID> eligible = Fixtures.eligible(request);
        assertThat(ranking.postIds()).hasSize(Math.min(request.limit(), eligible.size())).doesNotHaveDuplicates();
        assertThat(eligible).containsAll(ranking.postIds());
        assertThat(ranking.diagnostics().eligible()).isEqualTo(eligible.size());
        assertThat(ranking.items()).allSatisfy(item -> {
            assertThat(item.score()).isFinite();
            assertThat(item.authorId()).isNotEqualTo(request.viewer().id());
            assertThat(request.viewer().hiddenAuthors()).doesNotContain(item.authorId());
        });
        long needy = request.candidates().stream().filter(c -> c != null && eligible.contains(c.postId()))
                .filter(c -> c.stats().impressions() < config.minImpressions())
                .filter(c -> c.createdAt().isAfter(request.now().minus(config.exposureWindow())))
                .map(Candidate::postId).distinct().count();
        long shownNeedy = ranking.items().stream()
                .filter(r -> r.candidate().stats().impressions() < config.minImpressions())
                .filter(r -> r.candidate().createdAt().isAfter(request.now().minus(config.exposureWindow()))).count();
        int quota = ranking.items().size() / config.exposureBlock() * config.exposureSlots();
        assertThat(shownNeedy).as("under-exposed posts in complete blocks").isGreaterThanOrEqualTo(Math.min(needy, quota));
    }

    static void healthy(Ranking ranking) {
        assertThat(ranking.diagnostics().fallback()).isEmpty();
        assertThat(ranking.diagnostics().failures()).isEmpty();
        assertThat(ranking.diagnostics().disabled()).isEmpty();
        assertThat(ranking.diagnostics().slow()).isEmpty();
    }
}
