package com.tennotalk.recommender.signals;

import static com.tennotalk.recommender.Fixtures.VIEWER;
import static com.tennotalk.recommender.Fixtures.id;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.Contexts;
import com.tennotalk.recommender.Fixtures;
import com.tennotalk.recommender.PostStats;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;
import com.tennotalk.recommender.Viewer;

/** What each v1 signal adds, on hand-made cases (PLAN.md §37.4). */
class SignalMathTest {

    /** Contribution of the decorator alone (inner score 0). */
    private static double contribution(BiFunction<Scorer, Double, ScoreDecorator> factory, double weight, Viewer viewer, Candidate candidate) {
        ScoreDecorator decorator = factory.apply(Scorer.ZERO, weight);
        return decorator.score(Contexts.of(viewer, List.of(decorator.name())), candidate);
    }

    private static Candidate.Builder post() {
        return Fixtures.postBuilder(1, 20);
    }

    @Nested
    class Squash {
        @Test
        void mapsTheRealLineIntoMinusOneOne() {
            assertThat(Signals.squash(0)).isZero();
            assertThat(Signals.squash(1)).isEqualTo(0.5);
            assertThat(Signals.squash(-3)).isEqualTo(-0.75);
            assertThat(Signals.squash(Double.NaN)).isZero();
            assertThat(Signals.squash(Double.POSITIVE_INFINITY)).isEqualTo(1);
            assertThat(Signals.squash(Double.NEGATIVE_INFINITY)).isEqualTo(-1);
        }
    }

    @Nested
    class Topics {
        @Test
        void sameInterestsGiveTheFullWeightAndOppositeOnesTakeItAway() {
            Viewer viewer = Viewer.builder(VIEWER).topics(Map.of("travel", 2.0)).build();
            assertThat(contribution(TopicAffinity::new, 3, viewer, post().topics(Map.of("travel", 1.0)).build())).isCloseTo(3, within(1e-12));
            assertThat(contribution(TopicAffinity::new, 3, viewer, post().topics(Map.of("food", 1.0)).build())).isZero();
            Viewer averse = Viewer.builder(VIEWER).topics(Map.of("travel", -2.0)).build();
            assertThat(contribution(TopicAffinity::new, 3, averse, post().topics(Map.of("travel", 1.0)).build())).isCloseTo(-3, within(1e-12));
        }
    }

    @Nested
    class Authors {
        @Test
        void affinityIsSquashed() {
            Viewer viewer = Viewer.builder(VIEWER).authors(Map.of(id(20), 1.0, id(21), -3.0)).build();
            assertThat(contribution(AuthorAffinity::new, 2, viewer, post().build())).isEqualTo(1.0);
            assertThat(contribution(AuthorAffinity::new, 2, viewer, Fixtures.postBuilder(1, 21).build())).isEqualTo(-1.5);
            assertThat(contribution(AuthorAffinity::new, 2, viewer, Fixtures.postBuilder(1, 22).build())).isZero();
        }
    }

    @Nested
    class Languages {
        private final Viewer learner = Viewer.builder(VIEWER).nativeLanguage("pt-BR").learningLanguages(List.of("ja")).build();

        @Test
        void eachExchangeSignalAdds() {
            assertThat(contribution(LanguageExchange::new, 1, learner, post().language("ja-JP").build())).isEqualTo(0.6);
            assertThat(contribution(LanguageExchange::new, 1, learner, post().authorNativeLanguage("ja").build())).isEqualTo(0.3);
            assertThat(contribution(LanguageExchange::new, 1, learner, post().authorLearningLanguages(List.of("pt")).build())).isEqualTo(0.3);
            assertThat(contribution(LanguageExchange::new, 1, learner, post().language("en").build())).isZero();
        }

        @Test
        void allTogetherAreCappedAtTheWeight() {
            Candidate perfect = post().language("ja").authorNativeLanguage("ja").authorLearningLanguages(List.of("pt")).build();
            assertThat(contribution(LanguageExchange::new, 1.5, learner, perfect)).isEqualTo(1.5);
        }

        @Test
        void aViewerWithoutANativeLanguageMatchesNoLearner() {
            Viewer blank = Viewer.builder(VIEWER).build();
            assertThat(contribution(LanguageExchange::new, 1, blank, post().authorLearningLanguages(List.of("")).build())).isZero();
        }
    }

    @Nested
    class Social {
        @Test
        void closestTieWins() {
            Viewer viewer = Viewer.builder(VIEWER).following(List.of(id(20))).chatPartners(List.of(id(20), id(21)))
                    .secondDegree(List.of(id(21), id(22))).build();
            assertThat(contribution(SocialProximity::new, 2, viewer, post().build())).isEqualTo(2.0);
            assertThat(contribution(SocialProximity::new, 2, viewer, Fixtures.postBuilder(1, 21).build())).isEqualTo(1.6);
            assertThat(contribution(SocialProximity::new, 2, viewer, Fixtures.postBuilder(1, 22).build())).isEqualTo(0.8);
            assertThat(contribution(SocialProximity::new, 2, viewer, Fixtures.postBuilder(1, 23).build())).isZero();
            assertThat(contribution(SocialProximity::new, 0.5, viewer, post().build())).isEqualTo(0.5);
        }
    }

    @Nested
    class Countries {
        @Test
        void learnedCountryAffinityCounts() {
            Viewer viewer = Viewer.builder(VIEWER).countries(Map.of("VN", 3.0)).build();
            assertThat(contribution(CountryAffinity::new, 1, viewer, post().authorCountry("vn").build())).isEqualTo(0.75);
            assertThat(contribution(CountryAffinity::new, 1, viewer, post().authorCountry("BR").build())).isZero();
            assertThat(contribution(CountryAffinity::new, 1, viewer, post().authorCountry("").build())).isZero();
        }
    }

    @Nested
    class EngagementRate {
        @Test
        void priorKeepsTinySamplesHumble() {
            double lucky = Engagement.signal(new PostStats(1, 1, 0, 0, 0, 0));
            double proven = Engagement.signal(new PostStats(1_000, 300, 0, 0, 0, 0));
            assertThat(proven).isGreaterThan(lucky);
        }

        @Test
        void commentsAndSharesWeighMoreThanLikesAndAttentionCounts() {
            PostStats likes = new PostStats(100, 6, 0, 0, 0, 0);
            PostStats comments = new PostStats(100, 0, 3, 0, 0, 0);
            PostStats shares = new PostStats(100, 0, 0, 2, 0, 0);
            assertThat(Engagement.signal(comments)).isEqualTo(Engagement.signal(likes));
            assertThat(Engagement.signal(shares)).isEqualTo(Engagement.signal(likes));
            assertThat(Engagement.signal(new PostStats(100, 6, 0, 0, 0, 500_000))).isGreaterThan(Engagement.signal(likes));
        }

        @Test
        void staysWithinZeroAndOne() {
            assertThat(Engagement.signal(PostStats.EMPTY)).isBetween(0.0, 1.0);
            assertThat(Engagement.signal(new PostStats(Long.MAX_VALUE, Long.MAX_VALUE, Long.MAX_VALUE, Long.MAX_VALUE, 0, Long.MAX_VALUE)))
                    .isBetween(0.0, 1.0);
            assertThat(Engagement.signal(new PostStats(1, 0, 0, 0, 0, 3_600_000))).isLessThanOrEqualTo(1.0);
        }

        @Test
        void exactValues() {
            // rate = (6 + 20 × 0.05) / (100 + 20) = 7/120; 0.7 × squash(rate / 0.2) + 0.3 × min(1, 4 s / 10 s)
            double rate = 7.0 / 120;
            double expected = 0.7 * (rate / 0.2) / (1 + rate / 0.2) + 0.3 * 0.4;
            assertThat(Engagement.signal(new PostStats(100, 6, 0, 0, 0, 400_000))).isCloseTo(expected, within(1e-12));
            double empty = 1.0 / 20 / 0.2;
            assertThat(Engagement.signal(PostStats.EMPTY)).isCloseTo(0.7 * empty / (1 + empty), within(1e-12));
        }

        @Test
        void contributionIsWeighted() {
            Candidate c = post().stats(new PostStats(100, 6, 0, 0, 0, 0)).build();
            assertThat(contribution(Engagement::new, 2, Fixtures.viewer(), c)).isCloseTo(2 * Engagement.signal(c.stats()), within(1e-12));
        }
    }

    @Nested
    class Neighbors {
        @Test
        void engagementOfSimilarPeopleCounts() {
            Viewer viewer = Viewer.builder(VIEWER).neighborEngagement(Map.of(id(1), 1.0)).build();
            assertThat(contribution(CollaborativeNeighbors::new, 1.5, viewer, post().build())).isEqualTo(0.75);
            assertThat(contribution(CollaborativeNeighbors::new, 1.5, viewer, Fixtures.postBuilder(2, 20).build())).isZero();
        }
    }

    @Nested
    class Explore {
        @Test
        void fewerImpressionsMeanMoreOptimism() {
            Candidate unseen = post().stats(PostStats.EMPTY).build();
            Candidate seen = post().stats(new PostStats(10_000, 0, 0, 0, 0, 0)).build();
            assertThat(contribution(Exploration::new, 1, Fixtures.viewer(), unseen))
                    .isGreaterThan(contribution(Exploration::new, 1, Fixtures.viewer(), seen));
            assertThat(contribution(Exploration::new, 1, Fixtures.viewer(), unseen)).isBetween(0.7, 1.0);
        }

        @Test
        void hugeCountersDoNotOverflow() {
            Candidate c = post().stats(new PostStats(Long.MAX_VALUE, 0, 0, 0, 0, 0)).build();
            assertThat(contribution(Exploration::new, 1, Fixtures.viewer(), c)).isFinite().isBetween(0.0, 0.3);
        }
    }

    @Nested
    class Negative {
        @Test
        void widelyHiddenPostsSink() {
            assertThat(NegativeFeedback.signal(PostStats.EMPTY)).isZero();
            assertThat(NegativeFeedback.signal(new PostStats(90, 0, 0, 0, 2, 0))).isEqualTo(0.1);
            assertThat(NegativeFeedback.signal(new PostStats(0, 0, 0, 0, 100, 0))).isEqualTo(1);
            Candidate c = post().stats(new PostStats(90, 0, 0, 0, 2, 0)).build();
            assertThat(contribution(NegativeFeedback::new, 3, Fixtures.viewer(), c)).isCloseTo(-0.3, within(1e-12));
        }
    }

    @Nested
    class Seen {
        @Test
        void alreadySeenPostsGoBack() {
            Viewer viewer = Viewer.builder(VIEWER).seen(List.of(id(1))).build();
            assertThat(contribution(SeenPenalty::new, 2, viewer, post().build())).isEqualTo(-2);
            assertThat(contribution(SeenPenalty::new, 2, viewer, Fixtures.postBuilder(2, 20).build())).isZero();
        }
    }

    @Nested
    class Weights {
        @Test
        void invalidWeightsSwitchSignalsOff() {
            RankingWeights weights = new RankingWeights(-1, Double.NaN, Double.POSITIVE_INFINITY, 2_000, 1, 1, 1, 1, 1, 1, 0, -1);
            assertThat(weights.topic()).isZero();
            assertThat(weights.author()).isZero();
            assertThat(weights.language()).isZero();
            assertThat(weights.social()).isEqualTo(1_000);
            assertThat(weights.authorGap()).isEqualTo(1);
            assertThat(weights.diversity()).isZero();
            assertThat(new RankingWeights(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 99, 1).authorGap()).isEqualTo(50);
        }
    }
}
