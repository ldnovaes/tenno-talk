package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.learning.Topics;

/**
 * Speed budget (PLAN.md §37.1): ranking 500 realistic candidates with every v1 signal takes well under
 * the 30 ms budget. The assertion is generous (a slow CI machine must pass); typical runs take 1–2 ms.
 */
@Tag("performance")
class PerformanceTest {

    private static final int CANDIDATES = 500;

    @Test
    void ranksFiveHundredCandidatesInAFewMilliseconds() {
        SplittableRandom random = new SplittableRandom(3);
        Map<String, Double> interests = new HashMap<>();
        for (int i = 0; i < 40; i++) interests.put(Topics.ALL.get(random.nextInt(Topics.ALL.size())), random.nextDouble(-2, 6));
        for (int i = 0; i < 30; i++) interests.put("tag:t" + i, random.nextDouble(0, 3));
        Map<UUID, Double> authors = new HashMap<>();
        List<UUID> following = new ArrayList<>();
        Map<UUID, Double> neighbors = new HashMap<>();
        for (int i = 0; i < 200; i++) {
            authors.put(Fixtures.id(10_000 + i), random.nextDouble(-3, 8));
            if (i % 4 == 0) following.add(Fixtures.id(10_000 + i));
        }
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < CANDIDATES; i++) {
            Map<String, Double> topics = new HashMap<>();
            for (int t = 0; t < 4; t++) topics.put(Topics.ALL.get(random.nextInt(Topics.ALL.size())), 1.0);
            for (int t = 0; t < 6; t++) topics.put("tag:t" + random.nextInt(60), 1.0);
            if (i % 3 == 0) neighbors.put(Fixtures.id(i + 1), random.nextDouble(0, 4));
            candidates.add(Candidate.builder(Fixtures.id(i + 1), Fixtures.id(10_000 + random.nextInt(300)))
                    .createdAt(Fixtures.NOW.minus(Duration.ofMinutes(random.nextInt(14 * 24 * 60))))
                    .language(random.nextBoolean() ? "ja" : "en").authorNativeLanguage("ja").authorLearningLanguages(List.of("pt"))
                    .authorCountry("JP").topics(topics)
                    .stats(new PostStats(random.nextInt(5_000), random.nextInt(500), random.nextInt(50), random.nextInt(20),
                            random.nextInt(10), random.nextInt(5_000_000)))
                    .build());
        }
        Viewer viewer = Viewer.builder(Fixtures.VIEWER).nativeLanguage("pt").learningLanguages(List.of("ja")).topics(interests)
                .authors(authors).following(following).neighborEngagement(neighbors).countries(Map.of("JP", 2.0)).build();
        Recommender recommender = Fixtures.standard();
        RankRequest request = new RankRequest(viewer, candidates, 300, 9, Fixtures.NOW);

        for (int i = 0; i < 300; i++) recommender.rank(request); // warm-up (JIT)
        long[] samples = new long[101];
        for (int i = 0; i < samples.length; i++) {
            long started = System.nanoTime();
            Ranking ranking = recommender.rank(request);
            samples[i] = System.nanoTime() - started;
            assertThat(ranking.diagnostics().usedFallback()).isFalse();
            assertThat(ranking.items()).hasSize(300);
        }
        Arrays.sort(samples);
        long medianMicros = samples[samples.length / 2] / 1_000;
        System.out.printf("[performance] 500 candidates: median %d µs, p90 %d µs%n", medianMicros, samples[90] / 1_000);

        assertThat(Duration.ofNanos(samples[samples.length / 2])).isLessThan(Duration.ofMillis(5));
    }
}
