package com.tennotalk.discovery;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.tennotalk.feed.FeedEvents.PostCreated;
import com.tennotalk.recommender.learning.Hashtags;

/**
 * Topics of new posts (PLAN.md §37.5): hashtags right away, AI classification through a queue. Runs after the
 * post commits; a failure here never fails the post, and the periodic sweep catches anything missed.
 */
@Component
public class TopicIndexer {

    private static final Logger log = LoggerFactory.getLogger(TopicIndexer.class);

    private final JdbcClient jdbc;
    private final DiscoverProperties properties;
    private final Clock clock;

    public TopicIndexer(JdbcClient jdbc, DiscoverProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.clock = clock;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPostCreated(PostCreated post) {
        try {
            index(post.postId(), post.caption());
        } catch (RuntimeException failure) {
            log.warn("Topics of post {} not indexed yet: {}", post.postId(), failure.toString());
        }
    }

    /** Stores the caption's hashtags and queues the AI classification. Idempotent. */
    @Transactional
    public void index(UUID post, String caption) {
        storeHashtags(post, caption);
        if (caption != null && !caption.isBlank()) {
            jdbc.sql("INSERT INTO classification_jobs (post_id) VALUES (:p) ON CONFLICT DO NOTHING").param("p", post).update();
        }
    }

    void storeHashtags(UUID post, String caption) {
        jdbc.sql("DELETE FROM post_topics WHERE post_id = :p AND source = 'hashtag'").param("p", post).update();
        for (Map.Entry<String, Double> topic : Hashtags.topics(caption).entrySet()) {
            jdbc.sql("INSERT INTO post_topics (post_id, source, topic, weight) VALUES (:p, 'hashtag', :t, :w)")
                    .param("p", post).param("t", topic.getKey()).param("w", topic.getValue()).update();
        }
    }

    /** Queues recent captioned posts that have no job (an indexing that failed after commit). */
    @Scheduled(fixedDelayString = "${tenno.discover.sweep-interval:5m}", initialDelayString = "${tenno.discover.sweep-delay:1m}")
    public void sweep() {
        if (!properties.workerEnabled()) return;
        runSweep();
    }

    @Transactional
    public int runSweep() {
        return jdbc.sql("""
                INSERT INTO classification_jobs (post_id)
                SELECT p.id FROM posts p
                WHERE p.caption_text IS NOT NULL AND p.created_at > :since
                  AND NOT EXISTS (SELECT 1 FROM classification_jobs j WHERE j.post_id = p.id)
                ON CONFLICT DO NOTHING
                """).param("since", java.sql.Timestamp.from(clock.instant().minus(properties.window()))).update();
    }
}
