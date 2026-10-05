package com.tennotalk.recommender;

import static com.tennotalk.recommender.Fixtures.NOW;
import static com.tennotalk.recommender.Fixtures.id;
import static com.tennotalk.recommender.Fixtures.posts;
import static com.tennotalk.recommender.Fixtures.request;
import static com.tennotalk.recommender.Fixtures.roomy;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tennotalk.recommender.Saboteurs.Constant;
import com.tennotalk.recommender.Saboteurs.FakeTicker;
import com.tennotalk.recommender.Saboteurs.Rogue;
import com.tennotalk.recommender.Saboteurs.Slow;
import com.tennotalk.recommender.Saboteurs.Throwing;
import com.tennotalk.recommender.signals.Engagement;
import com.tennotalk.recommender.signals.RankingWeights;
import com.tennotalk.recommender.signals.StandardRecommender;

/** Chaos: misbehaving signals never break the ranking (PLAN.md §37.3). */
class SafetyEnvelopeTest {

    /** Shuffled, so a fallback that forgot to sort would show. */
    private static final RankRequest REQUEST = request(Fixtures.viewer(), shuffled(withLikes(posts(30))), 30);

    private static List<Candidate> shuffled(List<Candidate> posts) {
        List<Candidate> result = new ArrayList<>(posts);
        java.util.Collections.shuffle(result, new java.util.Random(5));
        return result;
    }

    /** Varied likes, so Engagement actually reorders and a dropped signal would show. */
    private static List<Candidate> withLikes(List<Candidate> posts) {
        List<Candidate> result = new ArrayList<>();
        for (int i = 0; i < posts.size(); i++) {
            Candidate c = posts.get(i);
            result.add(Candidate.builder(c.postId(), c.authorId()).createdAt(c.createdAt())
                    .stats(new PostStats(1_000, (i * 37L) % 200, 0, 0, 0, 0)).build());
        }
        return result;
    }

    private static Recommender with(Function<Scorer, ? extends ScoreDecorator> saboteur) {
        return Recommender.builder().config(roomy()).score(inner -> new Engagement(inner, 2)).score(saboteur).build();
    }

    private static Recommender reference() {
        return Recommender.builder().config(roomy()).score(inner -> new Engagement(inner, 2)).build();
    }

    private static void assertValid(Ranking ranking, RankRequest request) {
        assertThat(ranking.postIds()).hasSize(Math.min(request.limit(), Fixtures.eligible(request).size())).doesNotHaveDuplicates();
        assertThat(Fixtures.eligible(request)).containsAll(ranking.postIds());
    }

    @Nested
    class ScoreDecorators {

        @Test
        void aSignalThatThrowsOnSomePostsIsDroppedForTheWholeRequest() {
            Ranking ranking = with(inner -> new Throwing(inner, "flaky", c -> c.postId().getLeastSignificantBits() % 3 == 0,
                    () -> new IllegalStateException("boom"))).rank(REQUEST);

            assertThat(ranking.postIds()).isEqualTo(reference().rank(REQUEST).postIds());
            assertThat(ranking.diagnostics().failures()).containsEntry("flaky", 10);
            assertThat(ranking.diagnostics().usedFallback()).isFalse();
        }

        @ParameterizedTest
        @ValueSource(doubles = {Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, 10.000001, -1e9})
        void invalidValuesAreRefused(double value) {
            Ranking ranking = with(inner -> new Constant(inner, "broken", value)).rank(REQUEST);

            assertThat(ranking.postIds()).isEqualTo(reference().rank(REQUEST).postIds());
            assertThat(ranking.diagnostics().failures()).containsEntry("broken", 30);
        }

        @Test
        void valuesAtTheCapAreAccepted() {
            Ranking ranking = with(inner -> new Constant(inner, "loud", 10)).rank(REQUEST);
            assertThat(ranking.diagnostics().failures()).isEmpty();
            assertThat(ranking.postIds()).isEqualTo(reference().rank(REQUEST).postIds());
        }

        @Test
        void errorsAreContainedToo() {
            for (Error error : List.<Error>of(new StackOverflowError(), new OutOfMemoryError("simulated"), new AssertionError())) {
                Ranking ranking = with(inner -> Throwing.error(inner, "fatal", () -> error)).rank(REQUEST);
                assertThat(ranking.postIds()).isEqualTo(reference().rank(REQUEST).postIds());
                assertThat(ranking.diagnostics().failures()).containsKey("fatal");
            }
        }

        @Test
        void aDecoratorThatEscapesTheGuardStillYieldsTheSafeRanking() {
            // Ignores the inner scorer and wraps one that throws: the exception leaves the decorator chain.
            Scorer rogueInner = (context, candidate) -> {
                throw new IllegalStateException("escaped");
            };
            Recommender recommender = Recommender.builder().config(roomy()).score(inner -> new Constant(rogueInner, "rogue", 0.1)).build();

            Ranking ranking = recommender.rank(REQUEST);

            assertValid(ranking, REQUEST);
            assertThat(ranking.diagnostics().fallback()).isEqualTo("error:IllegalStateException");
            assertThat(ranking.postIds()).isEqualTo(Fixtures.core().rank(REQUEST).postIds());
        }

        @Test
        void aTickerThatThrowsStillYieldsAValidRanking() {
            Recommender recommender = StandardRecommender.builder(RankingWeights.defaults(), roomy()).ticker(() -> {
                throw new IllegalStateException("clock");
            }).build();

            Ranking ranking = recommender.rank(REQUEST);

            assertValid(ranking, REQUEST);
            assertThat(ranking.diagnostics().usedFallback()).isTrue();
        }

        @Test
        void everySignalFailingAtOnceLeavesTheCoreRanking() {
            Recommender.Builder builder = Recommender.builder().config(roomy());
            for (int i = 0; i < 12; i++) {
                String name = "broken-" + i;
                builder.score(inner -> new Throwing(inner, name, c -> true, () -> new RuntimeException(name)));
            }

            Ranking ranking = builder.build().rank(REQUEST);

            assertThat(ranking.postIds()).isEqualTo(Fixtures.core().rank(REQUEST).postIds());
            assertThat(ranking.diagnostics().failures()).hasSize(12);
        }
    }

    @Nested
    class Budget {

        @Test
        void overBudgetReturnsTheSafeRankingAndNamesTheSlowSignal() {
            FakeTicker ticker = new FakeTicker();
            RecommenderConfig config = RecommenderConfig.defaults(); // 30 ms
            Recommender recommender = Recommender.builder().config(config).ticker(ticker)
                    .score(inner -> new Engagement(inner, 2))
                    .score(inner -> new Slow(inner, "sloth", ticker, Duration.ofMillis(2).toNanos())).build();

            Ranking ranking = recommender.rank(REQUEST);

            assertThat(ranking.diagnostics().fallback()).isEqualTo("budget");
            assertThat(ranking.diagnostics().slow()).containsExactly("sloth");
            assertValid(ranking, REQUEST);
            assertThat(ranking.postIds()).isEqualTo(Fixtures.core().rank(REQUEST).postIds());
        }

        @Test
        void aSlowSignalIsSwitchedOffByItsBreaker() {
            FakeTicker ticker = new FakeTicker();
            RecommenderConfig config = RecommenderConfig.defaults();
            Recommender recommender = Recommender.builder().config(config).ticker(ticker)
                    .score(inner -> new Engagement(inner, 2))
                    .score(inner -> new Slow(inner, "sloth", ticker, Duration.ofMillis(2).toNanos())).build();

            for (int i = 0; i < config.breakerThreshold(); i++) recommender.rank(REQUEST);
            Ranking afterwards = recommender.rank(REQUEST);

            assertThat(afterwards.diagnostics().disabled()).containsExactly("sloth");
            assertThat(afterwards.diagnostics().usedFallback()).isFalse();
            assertThat(afterwards.postIds()).isEqualTo(reference().rank(REQUEST).postIds());
        }
    }

    @Nested
    class Breakers {

        private final RecommenderConfig config = roomy();

        private RankRequest at(Instant now) {
            return new RankRequest(REQUEST.viewer(), REQUEST.candidates(), REQUEST.limit(), REQUEST.seed(), now);
        }

        @Test
        void opensAfterTheThresholdAndRetriesAfterTheCooldown() {
            Recommender recommender = with(inner -> new Throwing(inner, "flaky", c -> true, IllegalStateException::new));

            for (int i = 0; i < config.breakerThreshold() - 1; i++) {
                assertThat(recommender.rank(at(NOW)).diagnostics().disabled()).isEmpty();
            }
            recommender.rank(at(NOW));
            assertThat(recommender.rank(at(NOW)).diagnostics().disabled()).containsExactly("flaky");
            assertThat(recommender.rank(at(NOW.plus(config.breakerCooldown()).minusSeconds(1))).diagnostics().disabled())
                    .containsExactly("flaky");

            // Trial after the cooldown: still failing, so it reopens at once.
            Instant trial = NOW.plus(config.breakerCooldown());
            assertThat(recommender.rank(at(trial)).diagnostics().failures()).containsKey("flaky");
            assertThat(recommender.rank(at(trial.plusSeconds(1))).diagnostics().disabled()).containsExactly("flaky");
        }

        @Test
        void aSuccessfulTrialClosesTheCircuit() {
            boolean[] broken = {true};
            Recommender recommender = with(inner -> new Throwing(inner, "flaky", c -> broken[0], IllegalStateException::new));
            for (int i = 0; i < config.breakerThreshold(); i++) recommender.rank(at(NOW));
            assertThat(recommender.rank(at(NOW)).diagnostics().disabled()).containsExactly("flaky");

            broken[0] = false;
            Instant later = NOW.plus(config.breakerCooldown());
            assertThat(recommender.rank(at(later)).diagnostics().failures()).isEmpty();
            for (int i = 0; i < config.breakerThreshold() + 2; i++) {
                assertThat(recommender.rank(at(later.plusSeconds(i))).diagnostics().disabled()).isEmpty();
            }
        }

        @Test
        void intermittentFailuresBelowTheThresholdNeverOpenIt() {
            int[] calls = {0};
            Recommender recommender = with(inner -> new Throwing(inner, "flaky", c -> calls[0] % 2 == 0, IllegalStateException::new));
            for (int i = 0; i < 20; i++) {
                calls[0] = i;
                assertThat(recommender.rank(at(NOW)).diagnostics().disabled()).isEmpty();
            }
        }
    }

    @Nested
    class Rerankers {

        private Ranking rankWith(Function<List<Ranked>, List<Ranked>> rogue) {
            return Recommender.builder().config(roomy()).score(inner -> new Engagement(inner, 2))
                    .rerank(inner -> new Rogue(inner, "rogue", rogue)).build().rank(REQUEST);
        }

        private void assertRefused(Function<List<Ranked>, List<Ranked>> rogue) {
            Ranking ranking = rankWith(rogue);
            assertThat(ranking.postIds()).isEqualTo(reference().rank(REQUEST).postIds());
            assertThat(ranking.diagnostics().failures()).containsEntry("rogue", 1);
        }

        @Test
        void losingAPostIsRefused() {
            assertRefused(list -> list.subList(1, list.size()));
        }

        @Test
        void duplicatingAPostIsRefused() {
            assertRefused(list -> {
                list.set(1, list.get(0));
                return list;
            });
        }

        @Test
        void inventingAPostIsRefused() {
            assertRefused(list -> {
                list.set(0, new Ranked(Fixtures.post(999_999, 5), 1, false, null));
                return list;
            });
        }

        @Test
        void nullsAndNonFiniteScoresAreRefused() {
            assertRefused(list -> null);
            assertRefused(list -> {
                list.set(0, null);
                return list;
            });
            assertRefused(list -> {
                Ranked first = list.get(0);
                list.set(0, new Ranked(first.candidate(), Double.NaN, false, null));
                return list;
            });
        }

        @Test
        void throwingIsRefused() {
            assertRefused(list -> {
                throw new IllegalStateException("rerank");
            });
        }

        @Test
        void aValidReorderIsKept() {
            Ranking ranking = rankWith(list -> {
                java.util.Collections.reverse(list);
                return list;
            });
            List<UUID> expected = new ArrayList<>(reference().rank(REQUEST).postIds());
            java.util.Collections.reverse(expected);
            assertThat(ranking.postIds()).isEqualTo(expected);
            assertThat(ranking.diagnostics().failures()).isEmpty();
        }
    }

    @Nested
    class DegenerateRequests {

        @Test
        void nullRequestGivesAnEmptyRanking() {
            Ranking ranking = Fixtures.standard().rank(null);
            assertThat(ranking.items()).isEmpty();
            assertThat(ranking.diagnostics().usedFallback()).isFalse();
        }

        @Test
        void nullPartsAreTolerated() {
            List<Candidate> withNulls = new ArrayList<>(posts(3));
            withNulls.add(null);
            withNulls.add(Candidate.builder(null, id(1)).build());
            withNulls.add(Candidate.builder(id(77), null).build());

            Ranking ranking = Fixtures.standard().rank(new RankRequest(null, withNulls, 10, 0, null));

            assertThat(ranking.postIds()).containsExactlyInAnyOrder(id(1), id(2), id(3));
        }

        @Test
        void zeroOrNegativeLimitGivesNothing() {
            assertThat(Fixtures.standard().rank(request(Fixtures.viewer(), posts(5), 0)).items()).isEmpty();
            assertThat(Fixtures.standard().rank(request(Fixtures.viewer(), posts(5), -1)).items()).isEmpty();
        }

        @Test
        void extremeInstantsDoNotDegradeTheRanking() {
            List<Candidate> posts = new ArrayList<>(posts(3));
            posts.add(Candidate.builder(id(50), id(51)).createdAt(Instant.MIN).build());
            posts.add(Candidate.builder(id(52), id(53)).createdAt(Instant.MAX).build());

            Ranking ranking = Fixtures.standard().rank(request(Fixtures.viewer(), posts, 10));

            assertThat(ranking.postIds()).hasSize(5);
            assertThat(ranking.diagnostics().usedFallback()).isFalse();
        }
    }
}
