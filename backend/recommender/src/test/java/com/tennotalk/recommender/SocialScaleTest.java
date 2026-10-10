package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tennotalk.recommender.signals.RankingWeights;
import com.tennotalk.recommender.signals.StandardRecommender;

@Tag("stress")
@Timeout(value = 5, unit = TimeUnit.MINUTES)
class SocialScaleTest {
    private static final int CATALOG = 100_000;
    private static final int SESSIONS = 4_000;

    @ParameterizedTest
    @ValueSource(longs = {7, 42, 20261007})
    void millionsOfCandidateEvaluationsPreserveEveryContract(long seed) throws Exception {
        SocialPopulation population = new SocialPopulation(CATALOG, seed);
        Recommender recommender = Fixtures.standard();
        for (int i = 0; i < 100; i++) recommender.rank(population.request(i));
        StressReport report = new StressReport();
        for (int session = 0; session < SESSIONS; session++) {
            RankRequest request = population.request(session);
            long started = System.nanoTime();
            Ranking ranking = recommender.rank(request);
            report.add(request, ranking, System.nanoTime() - started);
            try {
                RankingAssertions.valid(request, ranking, recommender.config());
                RankingAssertions.healthy(ranking);
                if (session % 100 == 0) assertThat(recommender.rank(request).items()).isEqualTo(ranking.items());
            } catch (AssertionError failure) {
                report.write("population", seed, CATALOG);
                throw new AssertionError("seed=" + seed + ", session=" + session, failure);
            }
        }
        report.write("population", seed, CATALOG);
    }

    @Test
    void sharedInstanceMatchesSequentialResultsAcrossEightThreads() throws Exception {
        SocialPopulation population = new SocialPopulation(CATALOG, 73);
        Recommender shared = Fixtures.standard();
        List<RankRequest> requests = new ArrayList<>();
        List<List<Ranked>> expected = new ArrayList<>();
        for (int i = 0; i < 256; i++) {
            RankRequest request = population.request(i);
            requests.add(request);
            Ranking baseline = shared.rank(request);
            RankingAssertions.healthy(baseline);
            expected.add(baseline.items());
        }
        CountDownLatch ready = new CountDownLatch(8);
        CountDownLatch start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<Integer>> tasks = new ArrayList<>();
            for (int worker = 0; worker < 8; worker++) {
                int offset = worker * 31;
                tasks.add(() -> {
                    ready.countDown();
                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                    for (int i = 0; i < requests.size(); i++) {
                        int index = (i + offset) % requests.size();
                        Ranking result = shared.rank(requests.get(index));
                        RankingAssertions.healthy(result);
                        RankingAssertions.valid(requests.get(index), result, shared.config());
                        assertThat(result.items()).as("request %d", index).isEqualTo(expected.get(index));
                    }
                    return requests.size();
                });
            }
            var futures = tasks.stream().map(pool::submit).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            int completed = 0;
            for (var future : futures) completed += future.get(2, TimeUnit.MINUTES);
            assertThat(completed).isEqualTo(2_048);
        } finally {
            start.countDown();
            pool.shutdownNow();
            assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void productionBudgetDoesNotPassBySilentlyDisablingPersonalization() throws Exception {
        SocialPopulation population = new SocialPopulation(CATALOG, 91);
        // Warm the code using a separate instance, so warm-up cannot leave measured circuits open.
        Recommender warmup = Fixtures.standard();
        for (int i = 0; i < 300; i++) warmup.rank(population.request(i));
        Recommender production = StandardRecommender.create(RankingWeights.defaults(), RecommenderConfig.defaults());
        StressReport report = new StressReport();
        for (int i = 0; i < 2_000; i++) {
            RankRequest request = population.request(i);
            long started = System.nanoTime();
            Ranking ranking = production.rank(request);
            report.add(request, ranking, System.nanoTime() - started);
            RankingAssertions.valid(request, ranking, production.config());
        }
        report.write("production-budget", 91, CATALOG);
        assertThat(report.fallbackRate()).as("fallback rate < 1%%").isLessThan(.01);
        assertThat(report.degradedRate()).as("slow/failed/disabled signals < 1%%").isLessThan(.01);
        // In-memory ranking only; HTTP/SQL have their own budget in PLAN.md §37.1.
        assertThat(report.percentile(.95)).as("rank p95 in ms").isLessThan(80);
    }
}
