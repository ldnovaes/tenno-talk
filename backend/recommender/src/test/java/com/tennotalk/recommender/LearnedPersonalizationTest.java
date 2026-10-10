package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tennotalk.recommender.learning.InteractionKind;
import com.tennotalk.recommender.learning.SignalUpdater;

class LearnedPersonalizationTest {
    private final SignalUpdater updater = new SignalUpdater(Duration.ofDays(14));

    /** Balanced relevance labels, distinct authors, equal age/stats: chronology cannot guess a person's taste. */
    private List<Candidate> catalog() {
        List<Candidate> posts = new ArrayList<>();
        for (int i = 0; i < 480; i++) {
            posts.add(Fixtures.postBuilder(i + 1, 10_000 + i)
                    .topics(Map.of(SocialPopulation.TOPICS.get(i % 6), 1.0)).build());
        }
        return posts;
    }

    private void learn(Map<String, Double> interests, String topic, InteractionKind interaction, int events) {
        for (int i = 0; i < events; i++) {
            // Author/country omitted to isolate generalization to posts never interacted with.
            var deltas = SignalUpdater.affinityDeltas(interaction, 0, SparseVector.of(Map.of(topic, 1.0)), null, null);
            deltas.forEach((key, delta) -> interests.compute(key, (ignored, previous) ->
                    updater.apply(previous == null ? 0 : previous, Fixtures.NOW, delta, Fixtures.NOW)));
        }
    }

    private double precision(Ranking ranking, String topic) {
        return ranking.items().stream().filter(r -> r.candidate().topics().get(topic) > 0).count()
                / (double) ranking.items().size();
    }

    @ParameterizedTest
    @ValueSource(longs = {7, 42, 91, 20261007})
    void learnedPreferencesBeatChronologyForEveryCohort(long seed) {
        Recommender personalized = Fixtures.standard();
        Recommender chronological = Fixtures.core();
        List<Candidate> posts = catalog();
        for (String favorite : SocialPopulation.TOPICS) {
            Map<String, Double> interests = new HashMap<>();
            learn(interests, favorite, InteractionKind.LIKE, 8);
            Viewer viewer = Viewer.builder(Fixtures.VIEWER).topics(interests).build();
            RankRequest request = new RankRequest(viewer, posts, 20, seed, Fixtures.NOW);
            Ranking ranking = personalized.rank(request);
            RankingAssertions.healthy(ranking);
            double precision = precision(ranking, favorite);
            assertThat(precision).as("seed=%d topic=%s precision@20", seed, favorite).isGreaterThanOrEqualTo(.8);
            assertThat(precision - precision(chronological.rank(request), favorite)).isGreaterThanOrEqualTo(.5);
        }
    }

    @ParameterizedTest
    @ValueSource(longs = {7, 42, 91, 20261007})
    void negativeFeedbackAndNewLikesChangeTheFeedForEveryCohort(long seed) {
        Recommender recommender = Fixtures.standard();
        List<Candidate> posts = catalog();
        for (int cohort = 0; cohort < SocialPopulation.TOPICS.size(); cohort++) {
            String oldTopic = SocialPopulation.TOPICS.get(cohort);
            String newTopic = SocialPopulation.TOPICS.get((cohort + 1) % 6);
            Map<String, Double> interests = new HashMap<>();
            learn(interests, oldTopic, InteractionKind.LIKE, 8);
            Ranking before = recommender.rank(new RankRequest(
                    Viewer.builder(Fixtures.VIEWER).topics(interests).build(), posts, 20, seed, Fixtures.NOW));
            learn(interests, oldTopic, InteractionKind.HIDE_POST, 8);
            learn(interests, newTopic, InteractionKind.LIKE, 12);
            Ranking after = recommender.rank(new RankRequest(
                    Viewer.builder(Fixtures.VIEWER).topics(interests).build(), posts, 20, seed, Fixtures.NOW));
            RankingAssertions.healthy(before);
            RankingAssertions.healthy(after);
            assertThat(precision(before, oldTopic)).isGreaterThanOrEqualTo(.8);
            assertThat(precision(after, newTopic)).isGreaterThanOrEqualTo(.8);
            assertThat(precision(after, oldTopic)).isLessThanOrEqualTo(.1);
        }
    }
}
