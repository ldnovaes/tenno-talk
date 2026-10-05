package com.tennotalk.recommender;

import static com.tennotalk.recommender.Fixtures.id;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Model constructors normalize instead of throwing. */
class ModelTest {

    @Nested
    class SparseVectors {

        @Test
        void dropsNullNonFiniteAndZeroWeights() {
            Map<String, Double> raw = new HashMap<>();
            raw.put("a", 1.0);
            raw.put("b", Double.NaN);
            raw.put("c", Double.POSITIVE_INFINITY);
            raw.put("d", 0.0);
            raw.put(null, 2.0);
            raw.put("e", null);

            assertThat(SparseVector.of(raw).weights()).containsExactly(Map.entry("a", 1.0));
            assertThat(SparseVector.of(null)).isSameAs(SparseVector.EMPTY);
            assertThat(SparseVector.of(Map.of("x", 0.0))).isSameAs(SparseVector.EMPTY);
        }

        @Test
        void cosineAndDot() {
            SparseVector a = SparseVector.of(Map.of("travel", 3.0, "food", 4.0));
            SparseVector b = SparseVector.of(Map.of("travel", 1.0));

            assertThat(a.norm()).isEqualTo(5.0);
            assertThat(a.dot(b)).isEqualTo(3.0);
            assertThat(a.cosine(b)).isCloseTo(0.6, within(1e-12));
            assertThat(b.cosine(a)).isCloseTo(0.6, within(1e-12));
            assertThat(a.cosine(a)).isCloseTo(1.0, within(1e-12));
            assertThat(a.cosine(SparseVector.of(Map.of("travel", -3.0, "food", -4.0)))).isCloseTo(-1.0, within(1e-12));
            assertThat(a.cosine(SparseVector.EMPTY)).isZero();
            assertThat(a.cosine(null)).isZero();
            assertThat(a.dot(null)).isZero();
            assertThat(SparseVector.EMPTY.dot(a)).isZero();
        }

        @Test
        void hugeWeightsStayWithinRange() {
            SparseVector huge = SparseVector.of(Map.of("a", Double.MAX_VALUE, "b", Double.MAX_VALUE));
            assertThat(huge.cosine(huge)).isBetween(-1.0, 1.0);
        }

        @Test
        void getAndEquality() {
            SparseVector a = SparseVector.of(Map.of("x", 2.0));
            assertThat(a.get("x")).isEqualTo(2.0);
            assertThat(a.get("y")).isZero();
            assertThat(a.get(null)).isZero();
            assertThat(a).isEqualTo(SparseVector.of(Map.of("x", 2.0))).hasSameHashCodeAs(SparseVector.of(Map.of("x", 2.0)));
            assertThat(a).isNotEqualTo(SparseVector.EMPTY);
            assertThat(a.toString()).contains("x");
        }
    }

    @Nested
    class Candidates {

        @Test
        void normalizesEverything() {
            Candidate c = new Candidate(id(1), id(2), null, " PT-br ", "EN_us", null, " br ", null, null);

            assertThat(c.createdAt()).isEqualTo(Instant.EPOCH);
            assertThat(c.language()).isEqualTo("pt");
            assertThat(c.authorNativeLanguage()).isEqualTo("en");
            assertThat(c.authorLearningLanguages()).isEmpty();
            assertThat(c.authorCountry()).isEqualTo("BR");
            assertThat(new Candidate(id(1), id(2), null, "-x", "en", null, "", null, null).language()).isEmpty();
            assertThat(c.topics()).isSameAs(SparseVector.EMPTY);
            assertThat(c.stats()).isEqualTo(PostStats.EMPTY);
        }

        @Test
        void learningLanguagesDropBlanksAndNulls() {
            Candidate c = Candidate.builder(id(1), id(2)).authorLearningLanguages(Arrays.asList("ja-JP", null, " ", "JA")).build();
            assertThat(c.authorLearningLanguages()).containsExactly("ja");
        }

        @Test
        void instantsAreClampedToASafeRange() {
            assertThat(Candidate.builder(id(1), id(2)).createdAt(Instant.MIN).build().createdAt()).isEqualTo(Instant.EPOCH);
            assertThat(Candidate.builder(id(1), id(2)).createdAt(Instant.MAX).build().createdAt())
                    .isEqualTo(Instant.parse("9999-12-31T23:59:59Z"));
        }

        @Test
        void hasIds() {
            assertThat(Candidate.builder(id(1), id(2)).build().hasIds()).isTrue();
            assertThat(Candidate.builder(null, id(2)).build().hasIds()).isFalse();
            assertThat(Candidate.builder(id(1), null).build().hasIds()).isFalse();
        }
    }

    @Nested
    class Viewers {

        @Test
        void normalizesEverything() {
            Viewer v = new Viewer(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);

            assertThat(v.nativeLanguage()).isEmpty();
            assertThat(v.learningLanguages()).isEmpty();
            assertThat(v.topics()).isSameAs(SparseVector.EMPTY);
            assertThat(v.authors()).isEmpty();
            assertThat(v.following()).isEmpty();
            assertThat(v.hiddenAuthors()).isEmpty();
            assertThat(v.authorAffinity(id(1))).isZero();
            assertThat(v.authorAffinity(null)).isZero();
            assertThat(v.neighborEngagement(null)).isZero();
        }

        @Test
        void collectionsDropNullsAndMapsDropNonFiniteValues() {
            Map<UUID, Double> authors = new HashMap<>();
            authors.put(id(1), 2.0);
            authors.put(id(2), Double.NaN);
            authors.put(null, 1.0);
            Viewer v = Viewer.builder(id(9)).following(Arrays.asList(id(1), null)).authors(authors)
                    .neighborEngagement(Map.of(id(3), 0.5)).country(" vn ").build();

            assertThat(v.following()).containsExactly(id(1));
            assertThat(v.authors()).containsExactly(Map.entry(id(1), 2.0));
            assertThat(v.authorAffinity(id(1))).isEqualTo(2.0);
            assertThat(v.neighborEngagement(id(3))).isEqualTo(0.5);
            assertThat(v.country()).isEqualTo("VN");
        }
    }

    @Nested
    class Others {

        @Test
        void postStatsClampNegativeCounts() {
            PostStats stats = new PostStats(-1, -2, -3, -4, -5, -6);
            assertThat(stats).isEqualTo(PostStats.EMPTY);
            assertThat(new PostStats(4, 0, 0, 0, 0, 8_000).averageDwellSeconds()).isEqualTo(2.0);
            assertThat(PostStats.EMPTY.averageDwellSeconds()).isZero();
        }

        @Test
        void requestDefaults() {
            RankRequest request = new RankRequest(null, null, -5, 1, null);
            assertThat(request.viewer().id()).isNull();
            assertThat(request.candidates()).isEmpty();
            assertThat(request.limit()).isZero();
            assertThat(request.now()).isNotNull();
            assertThat(request.explain()).isFalse();
        }

        @Test
        void requestKeepsNullCandidatesForSanitize() {
            RankRequest request = new RankRequest(null, Arrays.asList(null, Fixtures.post(1, 2)), 1, 1, Fixtures.NOW);
            assertThat(request.candidates()).hasSize(2);
        }

        @Test
        void configClampsNonsense() {
            RecommenderConfig config = new RecommenderConfig(Duration.ofMillis(-1), 99, 0, -5, null, Duration.ZERO, Double.NaN, 0, null);
            assertThat(config.budget()).isEqualTo(Duration.ofMillis(30));
            assertThat(config.exposureBlock()).isEqualTo(1);
            assertThat(config.exposureSlots()).isZero();
            assertThat(config.minImpressions()).isZero();
            assertThat(config.exposureWindow()).isEqualTo(Duration.ofHours(72));
            assertThat(config.freshnessHalfLife()).isEqualTo(Duration.ofHours(24));
            assertThat(config.contributionCap()).isEqualTo(10);
            assertThat(config.breakerThreshold()).isEqualTo(1);
            assertThat(config.breakerCooldown()).isEqualTo(Duration.ofMinutes(5));
            assertThat(new RecommenderConfig(null, 3, 10, 0, null, null, -1, 1, null).exposureSlots()).isEqualTo(3);
            assertThat(new RecommenderConfig(null, 3, 10, 0, null, null, -1, 1, null).contributionCap()).isEqualTo(10);
            assertThat(new RecommenderConfig(null, 3, 10, 0, null, null, 0, 1, null).contributionCap()).isEqualTo(10);
            assertThat(new RecommenderConfig(null, 3, 10, 0, null, null, Double.POSITIVE_INFINITY, 1, null).contributionCap()).isEqualTo(10);
            assertThat(new RecommenderConfig(null, 3, 10, 0, null, null, 0.5, 1, null).contributionCap()).isEqualTo(0.5);
            assertThat(new RecommenderConfig(Duration.ofMillis(7), 3, 10, 0, null, null, 1, 1, null).budget()).isEqualTo(Duration.ofMillis(7));
        }

        @Test
        void rankedAndRankingCopyDefensively() {
            Ranked ranked = new Ranked(Fixtures.post(1, 2), 1, false, null);
            assertThat(ranked.contributions()).isEmpty();
            assertThat(ranked.asExposure().exposure()).isTrue();
            assertThat(ranked.asExposure().asExposure()).isEqualTo(ranked.asExposure());
            assertThat(new Ranking(null, null).items()).isEmpty();
            Diagnostics d = new Diagnostics(0, 0, null, null, null, null, 0, 0);
            assertThat(d.failures()).isEmpty();
            assertThat(d.usedFallback()).isFalse();
            assertThat(List.of(d.slow(), d.disabled())).allMatch(java.util.Set::isEmpty);
        }
    }
}
