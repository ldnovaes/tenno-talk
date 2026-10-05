package com.tennotalk.recommender;

import static com.tennotalk.recommender.Fixtures.NOW;
import static com.tennotalk.recommender.Fixtures.VIEWER;
import static com.tennotalk.recommender.Fixtures.id;
import static com.tennotalk.recommender.Fixtures.post;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.Saboteurs.Constant;
import com.tennotalk.recommender.signals.RankingWeights;
import com.tennotalk.recommender.signals.StandardRecommender;

class CoreStagesTest {

    @Nested
    class SanitizeAndFilter {

        @Test
        void sanitizeKeepsTheFirstOfEachIdAndDropsBrokenOnes() {
            Candidate first = post(1, 10);
            Candidate repeated = post(1, 11);
            List<Candidate> result = Sanitize.apply(Arrays.asList(null, first, repeated, Candidate.builder(null, id(3)).build(), post(2, 12)));
            assertThat(result).containsExactly(first, post(2, 12));
        }

        @Test
        void hardFilterRemovesOwnHiddenPostsAndHiddenAuthors() {
            Viewer viewer = Viewer.builder(VIEWER).hiddenPosts(List.of(id(2))).hiddenAuthors(List.of(id(30))).build();
            List<Candidate> all = List.of(post(1, 1_000_000), post(2, 20), post(3, 30), post(4, 40));
            assertThat(HardFilter.apply(viewer, all)).extracting(Candidate::postId).containsExactly(id(4));
        }

        @Test
        void anonymousViewersOnlyLoseHiddenNothing() {
            assertThat(HardFilter.apply(Viewer.anonymous(null), List.of(post(1, 2)))).hasSize(1);
        }
    }

    @Nested
    class DisplayOrder {

        @Test
        void scoreThenNewerThenId() {
            Ranked high = new Ranked(post(5, 1), 2, false, null);
            Ranked newer = new Ranked(post(4, 1, Duration.ofHours(1), 0), 1, false, null);
            Ranked older = new Ranked(post(3, 1, Duration.ofHours(2), 0), 1, false, null);
            Ranked sameTimeHigherId = new Ranked(post(9, 1, Duration.ofHours(2), 0), 1, false, null);
            List<Ranked> list = new ArrayList<>(List.of(sameTimeHigherId, older, newer, high));
            list.sort(Ordering.BY_SCORE);
            assertThat(list).containsExactly(high, newer, older, sameTimeHigherId);
        }
    }

    @Nested
    class FreshnessScore {

        private final Freshness freshness = new Freshness(Duration.ofHours(24));
        private final RankContext context = Contexts.of(Fixtures.viewer(), List.of());

        @Test
        void halvesEveryHalfLife() {
            assertThat(freshness.score(context, post(1, 2, Duration.ZERO, 0))).isEqualTo(1.0);
            assertThat(freshness.score(context, post(1, 2, Duration.ofHours(24), 0))).isCloseTo(0.5, within(1e-12));
            assertThat(freshness.score(context, post(1, 2, Duration.ofHours(48), 0))).isCloseTo(0.25, within(1e-12));
        }

        @Test
        void futurePostsCountAsNewAndAncientOnesStayPositive() {
            assertThat(freshness.score(context, post(1, 2, Duration.ofHours(-3), 0))).isEqualTo(1.0);
            assertThat(freshness.score(context, Candidate.builder(id(1), id(2)).createdAt(java.time.Instant.EPOCH).build())).isPositive();
        }
    }

    @Nested
    class Invariants {

        private final List<Candidate> eligible = List.of(post(1, 1), post(2, 2), post(3, 3));

        private Ranked r(Candidate c) {
            return new Ranked(c, 1, false, null);
        }

        @Test
        void acceptsExactlyMinOfLimitAndEligible() {
            assertThat(InvariantCheck.holds(eligible, List.of(r(post(1, 1)), r(post(2, 2))), 2)).isTrue();
            assertThat(InvariantCheck.holds(eligible, List.of(r(post(1, 1))), 2)).isFalse(); // lost a post
            assertThat(InvariantCheck.holds(eligible, List.of(r(post(1, 1)), r(post(1, 1))), 2)).isFalse();
            assertThat(InvariantCheck.holds(eligible, List.of(r(post(1, 1)), r(post(9, 9))), 2)).isFalse();
            assertThat(InvariantCheck.holds(eligible, List.of(r(post(1, 1)), new Ranked(post(2, 2), Double.NaN, false, null)), 2)).isFalse();
            assertThat(InvariantCheck.holds(eligible, Arrays.asList(r(post(1, 1)), null), 2)).isFalse();
            assertThat(InvariantCheck.holds(eligible, null, 2)).isFalse();
            assertThat(InvariantCheck.holds(List.of(), List.of(), 5)).isTrue();
        }
    }

    @Nested
    class Breakers {

        @Test
        void opensClosesAndReopensOnTrial() {
            CircuitBreakers breakers = new CircuitBreakers(2, Duration.ofMinutes(1));
            breakers.record("s", true, NOW);
            assertThat(breakers.open(NOW)).isEmpty();
            breakers.record("s", false, NOW);
            breakers.record("s", true, NOW);
            assertThat(breakers.open(NOW)).isEmpty(); // a success reset the count
            breakers.record("s", true, NOW);
            assertThat(breakers.open(NOW)).containsExactly("s");
            assertThat(breakers.open(NOW.plusSeconds(60))).isEmpty();
            breakers.record("s", true, NOW.plusSeconds(60)); // failed trial
            assertThat(breakers.open(NOW.plusSeconds(61))).containsExactly("s");
            breakers.record("s", false, NOW.plusSeconds(121));
            breakers.record("s", true, NOW.plusSeconds(122));
            assertThat(breakers.open(NOW.plusSeconds(122))).isEmpty(); // closed again: back to the threshold
        }
    }

    @Nested
    class Context {

        @Test
        void noiseIsDeterministicUniformAndDependsOnSeedAndPost() {
            RankContext a = Contexts.of(Fixtures.viewer(), List.of());
            RankContext b = Contexts.of(Fixtures.viewer(), List.of());
            assertThat(a.noise(id(1))).isEqualTo(b.noise(id(1))).isBetween(0.0, 1.0);
            assertThat(a.noise(id(1))).isNotEqualTo(a.noise(id(2)));
            assertThat(a.noise(null)).isBetween(0.0, 1.0);
            double sum = 0;
            for (int i = 0; i < 10_000; i++) sum += a.noise(id(i));
            assertThat(sum / 10_000).isCloseTo(0.5, within(0.02));
        }

        @Test
        void noiseIsUniformAndUncorrelatedForSequentialIds() {
            RankContext context = Contexts.of(Fixtures.viewer(), List.of());
            int[] buckets = new int[10];
            double previous = context.noise(id(0));
            double products = 0;
            int n = 20_000;
            for (int i = 1; i <= n; i++) {
                double value = context.noise(id(i));
                buckets[(int) (value * 10)]++;
                products += (value - 0.5) * (previous - 0.5);
                previous = value;
            }
            for (int count : buckets) assertThat(count).isBetween(n / 10 - 300, n / 10 + 300);
            assertThat(products / n / (1.0 / 12)).isBetween(-0.03, 0.03); // lag-1 autocorrelation
        }

        @Test
        void unknownSignalsAreNotEnabledAndDoNotCrashAccounting() {
            RankContext context = Contexts.of(Fixtures.viewer(), List.of("known"));
            assertThat(context.enabled("known")).isTrue();
            assertThat(context.enabled("unknown")).isFalse();
            context.spent("unknown", 5);
            assertThat(context.nanos("unknown")).isZero();
            assertThat(Contexts.disabled(Fixtures.viewer(), List.of("known")).enabled("known")).isFalse();
        }
    }

    @Nested
    class Building {

        @Test
        void signalsAreListedInOrder() {
            assertThat(StandardRecommender.create(RankingWeights.defaults(), Fixtures.roomy()).signals()).containsExactly(
                    "topic-affinity", "author-affinity", "language-exchange", "social-proximity", "country-affinity", "engagement",
                    "collaborative-neighbors", "exploration", "negative-feedback", "seen-penalty", "topic-diversity", "author-spacing");
        }

        @Test
        void repeatedNamesFailAtBuildTime() {
            assertThatThrownBy(() -> Recommender.builder().score(inner -> new Constant(inner, "x", 0)).score(inner -> new Constant(inner, "x", 0)).build())
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("x");
        }

        @Test
        void freshnessIsReserved() {
            assertThatThrownBy(() -> Recommender.builder().score(inner -> new Constant(inner, "freshness", 0)).build())
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        void factoriesMustReturnADecorator() {
            assertThatThrownBy(() -> Recommender.builder().score(inner -> null).build()).isInstanceOf(NullPointerException.class);
            assertThatThrownBy(() -> Recommender.builder().rerank(inner -> null).build()).isInstanceOf(NullPointerException.class);
        }

        @Test
        void blankNamesFallBackToTheClassName() {
            assertThat(new Constant(null, " ", 0).name()).isEqualTo("Constant");
            assertThat(new Saboteurs.Rogue(null, null, list -> list).name()).isEqualTo("Rogue");
        }

        @Test
        void weightsAtTheCapAreAllowedAndTheTickerIsUsed() {
            RankingWeights atCap = new RankingWeights(10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0);
            Saboteurs.FakeTicker ticker = new Saboteurs.FakeTicker();
            Recommender recommender = StandardRecommender.create(atCap, RecommenderConfig.defaults(), ticker);
            ticker.advance(Duration.ofSeconds(1).toNanos());
            assertThat(recommender.rank(Fixtures.request(Fixtures.posts(3))).diagnostics().elapsedNanos()).isZero();
        }

        @Test
        void weightsAboveTheCapFailAtBuildTime() {
            RankingWeights loud = new RankingWeights(11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0);
            assertThatThrownBy(() -> StandardRecommender.create(loud, RecommenderConfig.defaults()))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void exposesItsConfig() {
            RecommenderConfig config = Fixtures.roomy();
            assertThat(Recommender.builder().config(config).build().config()).isEqualTo(config);
            assertThat(Recommender.builder().build().signals()).isEmpty();
        }
    }

    @Nested
    class Explain {

        @Test
        void contributionsAddUpToTheScore() {
            Viewer viewer = Viewer.builder(VIEWER).topics(java.util.Map.of("travel", 1.0)).following(List.of(id(20))).build();
            Candidate c = Fixtures.postBuilder(1, 20).topics(java.util.Map.of("travel", 1.0)).build();
            RankRequest request = new RankRequest(viewer, List.of(c), 1, 1, NOW, true);

            Ranked ranked = Fixtures.standard().rank(request).items().getFirst();

            assertThat(ranked.contributions()).containsKeys("freshness", "topic-affinity", "social-proximity");
            assertThat(ranked.contributions().values().stream().mapToDouble(Double::doubleValue).sum()).isCloseTo(ranked.score(), within(1e-9));
        }

        @Test
        void withoutExplainThereAreNoContributions() {
            assertThat(Fixtures.standard().rank(Fixtures.request(List.of(post(1, 2)))).items().getFirst().contributions()).isEmpty();
        }

        @Test
        void diagnosticsCountWhatCameInAndWhatWasEligible() {
            Viewer viewer = Viewer.builder(VIEWER).hiddenPosts(Set.of(id(2))).build();
            Ranking ranking = Fixtures.standard().rank(Fixtures.request(viewer, Arrays.asList(post(1, 5), post(2, 6), null), 5));
            assertThat(ranking.diagnostics().received()).isEqualTo(3);
            assertThat(ranking.diagnostics().eligible()).isEqualTo(1);
            assertThat(ranking.diagnostics().elapsedNanos()).isNotNegative();
        }
    }
}
