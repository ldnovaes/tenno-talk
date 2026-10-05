package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.UUID;
import java.util.function.Function;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.Saboteurs.Throwing;
import com.tennotalk.recommender.signals.RankingWeights;
import com.tennotalk.recommender.signals.StandardRecommender;

/**
 * "Nobody's post goes unseen because we failed" (PLAN.md §37.1), checked on a synthetic population:
 * 300 posts from 60 authors arrive over two days; 200 viewers with strong, biased interests open 6 000
 * sessions over four days and see the first page each time. Every post must reach the minimum impressions
 * inside its exposure window, with the real signals and with every signal sabotaged.
 */
@Tag("simulation")
class ExposureSimulationTest {

    private static final int POSTS = 300;
    private static final int AUTHORS = 60;
    private static final int VIEWERS = 200;
    private static final int SESSIONS = 6_000;
    private static final int PAGE = 10;
    private static final int MIN_IMPRESSIONS = 10;
    private static final List<String> TOPICS = List.of("travel", "food", "music", "sports", "books", "gaming");
    private static final Duration ARRIVALS = Duration.ofHours(48);
    private static final Duration HORIZON = Duration.ofHours(96);

    private final RecommenderConfig config = Fixtures.withExposure(Fixtures.roomy(), 2, PAGE, MIN_IMPRESSIONS);

    private record SimPost(UUID id, UUID author, Instant createdAt, String topic) {}

    private record Outcome(long[] impressions, Instant[] reachedMinimumAt, List<SimPost> posts) {

        long unseenInWindow(Duration window) {
            long count = 0;
            for (int i = 0; i < posts.size(); i++) {
                Instant deadline = posts.get(i).createdAt().plus(window);
                if (reachedMinimumAt[i] == null || reachedMinimumAt[i].isAfter(deadline)) count++;
            }
            return count;
        }

        double gini() {
            long[] sorted = impressions.clone();
            Arrays.sort(sorted);
            double weighted = 0;
            double total = 0;
            for (int i = 0; i < sorted.length; i++) {
                weighted += (i + 1) * (double) sorted[i];
                total += sorted[i];
            }
            int n = sorted.length;
            return total == 0 ? 0 : (2 * weighted) / (n * total) - (n + 1.0) / n;
        }
    }

    private Outcome simulate(Recommender recommender, long seed) {
        SplittableRandom random = new SplittableRandom(seed);
        Instant start = Fixtures.NOW;
        List<SimPost> posts = new ArrayList<>();
        for (int i = 0; i < POSTS; i++) {
            int author = random.nextInt(AUTHORS);
            String topic = random.nextDouble() < 0.8 ? TOPICS.get(author % TOPICS.size()) : TOPICS.get(random.nextInt(TOPICS.size()));
            Instant createdAt = start.plusSeconds(random.nextLong(ARRIVALS.toSeconds()));
            posts.add(new SimPost(Fixtures.id(1_000 + i), Fixtures.id(100 + author), createdAt, topic));
        }
        List<Viewer> viewers = new ArrayList<>();
        // Interests are skewed: half of everyone loves "travel", so other topics depend on the floor.
        for (int i = 0; i < VIEWERS; i++) {
            String favorite = random.nextBoolean() ? "travel" : TOPICS.get(random.nextInt(TOPICS.size()));
            viewers.add(Viewer.builder(Fixtures.id(50_000 + i)).topics(Map.of(favorite, 5.0)).learningLanguages(List.of("en")).build());
        }

        long[] impressions = new long[POSTS];
        long[] likes = new long[POSTS];
        Instant[] reached = new Instant[POSTS];
        for (int session = 0; session < SESSIONS; session++) {
            Instant now = start.plusSeconds(HORIZON.toSeconds() * session / SESSIONS);
            Viewer viewer = viewers.get(random.nextInt(VIEWERS));
            List<Candidate> candidates = new ArrayList<>();
            for (int p = 0; p < POSTS; p++) {
                SimPost post = posts.get(p);
                if (post.createdAt().isAfter(now)) continue;
                candidates.add(Candidate.builder(post.id(), post.author()).createdAt(post.createdAt()).language("en")
                        .topics(Map.of(post.topic(), 1.0)).stats(new PostStats(impressions[p], likes[p], 0, 0, 0, 0)).build());
            }
            Ranking ranking = recommender.rank(new RankRequest(viewer, candidates, PAGE, seed ^ session, now));
            assertThat(ranking.items()).hasSize(Math.min(PAGE, candidates.size()));
            for (Ranked shown : ranking.items()) {
                int p = (int) (shown.postId().getLeastSignificantBits() - 1_000);
                impressions[p]++;
                if (impressions[p] == MIN_IMPRESSIONS) reached[p] = now;
                if (viewer.topics().get(posts.get(p).topic()) > 0 && random.nextDouble() < 0.3) likes[p]++;
            }
        }
        return new Outcome(impressions, reached, posts);
    }

    @Test
    void everyPostIsSeenWithTheRealSignals() {
        Outcome outcome = simulate(StandardRecommender.create(RankingWeights.defaults(), config), 7);
        assertThat(outcome.unseenInWindow(config.exposureWindow())).isZero();
    }

    @Test
    void everyPostIsSeenWithEverySignalSabotaged() {
        Recommender.Builder builder = Recommender.builder().config(config);
        for (int i = 0; i < 10; i++) {
            String name = "sabotaged-" + i;
            Function<Scorer, ScoreDecorator> saboteur = inner -> new Throwing(inner, name, c -> true, () -> new IllegalStateException(name));
            builder.score(saboteur);
        }
        Outcome outcome = simulate(builder.build(), 11);
        assertThat(outcome.unseenInWindow(config.exposureWindow())).isZero();
    }

    @Test
    void withoutTheFloorPostsWouldGoUnseen() {
        // Control: proves the population is hard enough that the guarantee comes from the floor.
        RecommenderConfig noFloor = Fixtures.withExposure(config, 0, PAGE, MIN_IMPRESSIONS);
        Outcome outcome = simulate(StandardRecommender.create(RankingWeights.defaults(), noFloor), 7);
        assertThat(outcome.unseenInWindow(config.exposureWindow())).isPositive();
    }

    @Test
    void theFloorSpreadsAttention() {
        double withFloor = simulate(StandardRecommender.create(RankingWeights.defaults(), config), 7).gini();
        double withoutFloor = simulate(StandardRecommender.create(RankingWeights.defaults(),
                Fixtures.withExposure(config, 0, PAGE, MIN_IMPRESSIONS)), 7).gini();
        assertThat(withFloor).isLessThan(withoutFloor);
    }
}
