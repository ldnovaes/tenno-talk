package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.tennotalk.recommender.signals.Engagement;

import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

/** Invariants of the frozen core, for any input (PLAN.md §37.3, §37.8). */
class RecommenderPropertiesTest {

    private final Recommender standard = Fixtures.standard();
    private final Recommender core = Fixtures.core();

    @Provide
    Arbitrary<RankRequest> requests() {
        return Generators.requests();
    }

    @Property(tries = 1500)
    void neverThrowsAndAlwaysReturnsDiagnostics(@ForAll("requests") RankRequest request) {
        Ranking ranking = standard.rank(request);
        assertThat(ranking).isNotNull();
        assertThat(ranking.items()).isNotNull().doesNotContainNull();
        assertThat(ranking.diagnostics()).isNotNull();
    }

    @Property(tries = 1500)
    void returnsExactlyMinOfLimitAndEligibleDistinctEligiblePosts(@ForAll("requests") RankRequest request) {
        Set<UUID> eligible = Fixtures.eligible(request);
        List<UUID> ids = standard.rank(request).postIds();

        assertThat(ids).hasSize(Math.min(request.limit(), eligible.size()));
        assertThat(new HashSet<>(ids)).hasSameSizeAs(ids);
        assertThat(eligible).containsAll(ids);
    }

    @Property(tries = 1000)
    void neverShowsOwnHiddenPostsOrHiddenAuthors(@ForAll("requests") RankRequest request) {
        Viewer viewer = request.viewer();
        for (Ranked ranked : standard.rank(request).items()) {
            assertThat(ranked.authorId()).isNotEqualTo(viewer.id());
            assertThat(viewer.hiddenPosts()).doesNotContain(ranked.postId());
            assertThat(viewer.hiddenAuthors()).doesNotContain(ranked.authorId());
        }
    }

    @Property(tries = 1000)
    void scoresAreFinite(@ForAll("requests") RankRequest request) {
        assertThat(standard.rank(request).items()).allSatisfy(ranked -> assertThat(ranked.score()).isFinite());
    }

    @Property(tries = 500)
    void sameRequestSameRanking(@ForAll("requests") RankRequest request) {
        assertThat(standard.rank(request).postIds()).isEqualTo(standard.rank(request).postIds());
    }

    @Property(tries = 500)
    void wellFormedInputNeverNeedsTheFallback(@ForAll("requests") RankRequest request) {
        assertThat(standard.rank(request).diagnostics().fallback()).isEmpty();
        assertThat(standard.rank(request).diagnostics().failures()).isEmpty();
    }

    @Property(tries = 500)
    void candidateOrderDoesNotMatterWhenIdsAreUnique(@ForAll("requests") RankRequest request) {
        List<Candidate> unique = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Candidate candidate : request.candidates()) {
            if (candidate != null && candidate.postId() != null && candidate.authorId() != null && seen.add(candidate.postId())) {
                unique.add(candidate);
            }
        }
        List<Candidate> reversed = new ArrayList<>(unique);
        java.util.Collections.reverse(reversed);
        RankRequest forward = new RankRequest(request.viewer(), unique, request.limit(), request.seed(), request.now());
        RankRequest backward = new RankRequest(request.viewer(), reversed, request.limit(), request.seed(), request.now());

        assertThat(standard.rank(backward).postIds()).isEqualTo(standard.rank(forward).postIds());
    }

    @Property(tries = 500)
    void theCoreAloneKeepsTheSameGuarantees(@ForAll("requests") RankRequest request) {
        Set<UUID> eligible = Fixtures.eligible(request);
        List<UUID> ids = core.rank(request).postIds();
        assertThat(ids).hasSize(Math.min(request.limit(), eligible.size())).doesNotHaveDuplicates();
        assertThat(eligible).containsAll(ids);
    }

    @Property(tries = 300)
    void moreLikesNeverLowerAPost(@ForAll("requests") RankRequest request, @ForAll @IntRange(min = 1, max = 500) int extraLikes) {
        // Without rerankers and exposure slots, the order is the score order, so engagement must be monotonic.
        Recommender engagementOnly = Recommender.builder().config(Fixtures.withoutExposure(Fixtures.roomy()))
                .score(inner -> new Engagement(inner, 1.0)).build();
        List<UUID> before = engagementOnly.rank(request).postIds();
        if (before.isEmpty()) return;
        UUID target = before.getLast();
        List<Candidate> boosted = request.candidates().stream()
                .map(c -> c != null && target.equals(c.postId()) ? withMoreLikes(c, extraLikes) : c).toList();
        List<UUID> after = engagementOnly.rank(new RankRequest(request.viewer(), boosted, request.limit(), request.seed(), request.now()))
                .postIds();

        assertThat(after.indexOf(target)).isBetween(0, before.indexOf(target));
    }

    private static Candidate withMoreLikes(Candidate c, int extra) {
        PostStats s = c.stats();
        long likes = s.likes() > Long.MAX_VALUE - extra ? s.likes() : s.likes() + extra;
        return new Candidate(c.postId(), c.authorId(), c.createdAt(), c.language(), c.authorNativeLanguage(), c.authorLearningLanguages(),
                c.authorCountry(), c.topics(), new PostStats(s.impressions(), likes, s.comments(), s.shares(), s.hides(), s.dwellMsSum()));
    }
}
