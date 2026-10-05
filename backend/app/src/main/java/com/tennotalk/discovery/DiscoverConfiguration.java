package com.tennotalk.discovery;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.tennotalk.recommender.Recommender;
import com.tennotalk.recommender.learning.SignalUpdater;
import com.tennotalk.recommender.signals.StandardRecommender;

/** Wires the pure recommender module into the app (PLAN.md §37.2). */
@Configuration
class DiscoverConfiguration {

    @Bean
    Recommender recommender(DiscoverProperties properties) {
        return StandardRecommender.create(properties.rankingWeights(), properties.recommenderConfig());
    }

    @Bean
    SignalUpdater signalUpdater(DiscoverProperties properties) {
        return new SignalUpdater(properties.affinityHalfLife());
    }

    /**
     * Runs the ranking with a hard timeout. Small and bounded: when it is saturated, a request gets the
     * newest-first order instead of waiting.
     */
    @Bean(destroyMethod = "shutdownNow")
    RankingExecutor rankingExecutor() {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(2, 4, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(32),
                runnable -> {
                    Thread thread = new Thread(runnable, "discover-ranking");
                    thread.setDaemon(true);
                    return thread;
                }, new ThreadPoolExecutor.AbortPolicy());
        return new RankingExecutor(pool);
    }
}
