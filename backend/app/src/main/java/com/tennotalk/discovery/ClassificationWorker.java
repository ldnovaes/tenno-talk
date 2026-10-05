package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.tennotalk.recommender.learning.Topics;
import com.tennotalk.translation.FallbackTranslator;
import com.tennotalk.translation.ProviderOutcome;

/**
 * Labels captions with taxonomy topics through the AI providers (PLAN.md §37.5), like the translation queue:
 * claimed in a transaction, called outside it. Providers down or out of quota → the job waits without burning
 * attempts; transient failures → backoff, then give up (hashtags and behavior still rank the post).
 */
@Component
public class ClassificationWorker {

    private static final Logger log = LoggerFactory.getLogger(ClassificationWorker.class);

    static final int BATCH = 5;
    static final int MAX_ATTEMPTS = 3;
    static final Duration WAIT_FOR_PROVIDERS = Duration.ofMinutes(15);
    static final Duration STALE = Duration.ofMinutes(10);
    /** Topics the model ranks first weigh more: 1, 0.8, 0.6. */
    static final double WEIGHT_STEP = 0.2;

    private record Job(UUID post, int attempts) {}

    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final FallbackTranslator providers;
    private final TopicIndexer indexer;
    private final DiscoverProperties properties;
    private final Clock clock;

    public ClassificationWorker(JdbcClient jdbc, TransactionTemplate tx, FallbackTranslator providers, TopicIndexer indexer,
            DiscoverProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.providers = providers;
        this.indexer = indexer;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${tenno.discover.classification-interval:5s}")
    public void poll() {
        if (properties.workerEnabled()) runOnce();
    }

    /** Processes one batch; returns how many jobs were handled (tests call it directly). */
    public int runOnce() {
        List<Job> jobs = tx.execute(status -> claim(clock.instant()));
        if (jobs == null) return 0;
        for (Job job : jobs) {
            try {
                process(job);
            } catch (RuntimeException failure) {
                log.warn("Topic classification of post {} failed: {}", job.post(), failure.toString());
                retryLater(job, failure.toString());
            }
        }
        return jobs.size();
    }

    private List<Job> claim(Instant now) {
        jdbc.sql("UPDATE classification_jobs SET status = 'pending', locked_at = NULL WHERE status = 'running' AND locked_at < :stale")
                .param("stale", Timestamp.from(now.minus(STALE))).update();
        List<Job> jobs = jdbc.sql("""
                SELECT post_id, attempts FROM classification_jobs
                WHERE status = 'pending' AND run_after <= :now ORDER BY run_after LIMIT :n FOR UPDATE SKIP LOCKED
                """).param("now", Timestamp.from(now)).param("n", BATCH)
                .query((rs, row) -> new Job(rs.getObject("post_id", UUID.class), rs.getInt("attempts"))).list();
        for (Job job : jobs) {
            jdbc.sql("UPDATE classification_jobs SET status = 'running', locked_at = :now WHERE post_id = :p")
                    .param("now", Timestamp.from(now)).param("p", job.post()).update();
        }
        return jobs;
    }

    private void process(Job job) {
        Optional<String> caption = jdbc.sql("SELECT caption_text FROM posts WHERE id = :p").param("p", job.post())
                .query(String.class).optional();
        if (caption.isEmpty() || caption.get() == null || caption.get().isBlank()) {
            finish(job.post(), List.of());
            return;
        }
        // Hashtags first: they never depend on a provider.
        tx.executeWithoutResult(status -> indexer.storeHashtags(job.post(), caption.get()));
        switch (providers.classifyTopics(caption.get(), Topics.ALL)) {
            case ProviderOutcome.Success<List<String>> success -> finish(job.post(), success.value());
            case ProviderOutcome.Unavailable<List<String>> unavailable -> waitForProviders(job, unavailable.reason());
            case ProviderOutcome.Failed<List<String>> failed -> retryLater(job, failed.error());
        }
    }

    private void finish(UUID post, List<String> topics) {
        tx.executeWithoutResult(status -> {
            jdbc.sql("DELETE FROM post_topics WHERE post_id = :p AND source = 'ai'").param("p", post).update();
            for (int i = 0; i < topics.size(); i++) {
                if (!Topics.isTopic(topics.get(i))) continue;
                jdbc.sql("INSERT INTO post_topics (post_id, source, topic, weight) VALUES (:p, 'ai', :t, :w) ON CONFLICT DO NOTHING")
                        .param("p", post).param("t", topics.get(i)).param("w", 1 - WEIGHT_STEP * i).update();
            }
            jdbc.sql("UPDATE classification_jobs SET status = 'done', locked_at = NULL, last_error = NULL WHERE post_id = :p")
                    .param("p", post).update();
        });
    }

    private void waitForProviders(Job job, String reason) {
        jdbc.sql("""
                UPDATE classification_jobs SET status = 'pending', locked_at = NULL, run_after = :after, last_error = :reason
                WHERE post_id = :p
                """).param("after", Timestamp.from(clock.instant().plus(WAIT_FOR_PROVIDERS))).param("reason", reason)
                .param("p", job.post()).update();
    }

    private void retryLater(Job job, String error) {
        int attempts = job.attempts() + 1;
        Duration backoff = Duration.ofMinutes(1L << Math.min(attempts, 10));
        jdbc.sql("""
                UPDATE classification_jobs SET status = :status, attempts = :attempts, locked_at = NULL, run_after = :after,
                       last_error = :error
                WHERE post_id = :p
                """).param("status", attempts >= MAX_ATTEMPTS ? "failed" : "pending").param("attempts", attempts)
                .param("after", Timestamp.from(clock.instant().plus(backoff))).param("error", error).param("p", job.post()).update();
    }
}
