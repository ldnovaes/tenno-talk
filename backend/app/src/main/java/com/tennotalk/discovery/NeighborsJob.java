package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.tennotalk.recommender.SparseVector;
import com.tennotalk.recommender.learning.Neighbors;
import com.tennotalk.recommender.learning.SignalUpdater;

/**
 * Recomputes who has interests like whom (collaborative filtering, PLAN.md §37.5). Brute force over the people
 * active in the last {@value #ACTIVE_DAYS} days, capped at {@value #MAX_PEOPLE}: enough for the current scale.
 */
@Component
public class NeighborsJob {

    static final int ACTIVE_DAYS = 60;
    static final int MAX_PEOPLE = 5_000;
    static final int NEIGHBORS = 20;
    static final double MIN_SIMILARITY = 0.1;

    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final SignalUpdater updater;
    private final DiscoverProperties properties;
    private final Clock clock;

    public NeighborsJob(JdbcClient jdbc, TransactionTemplate tx, SignalUpdater updater, DiscoverProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.updater = updater;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${tenno.discover.neighbors-interval:15m}", initialDelayString = "${tenno.discover.neighbors-delay:2m}")
    public void poll() {
        if (properties.workerEnabled()) runOnce();
    }

    /** Replaces every neighbor list; returns how many people got one. */
    public int runOnce() {
        Instant now = clock.instant();
        Map<UUID, SparseVector> interests = interests(now);
        Map<UUID, List<Neighbors.Neighbor>> lists = new HashMap<>();
        interests.forEach((person, vector) -> {
            List<Neighbors.Neighbor> nearest = Neighbors.nearest(person, vector, interests, NEIGHBORS, MIN_SIMILARITY);
            if (!nearest.isEmpty()) lists.put(person, nearest);
        });
        tx.executeWithoutResult(status -> {
            jdbc.sql("DELETE FROM user_neighbors").update();
            lists.forEach((person, nearest) -> nearest.forEach(neighbor -> jdbc.sql("""
                    INSERT INTO user_neighbors (user_id, neighbor_id, similarity) VALUES (:u, :n, :s)
                    """).param("u", person).param("n", neighbor.id()).param("s", neighbor.similarity()).update()));
        });
        return lists.size();
    }

    /** Topic and hashtag interests (not authors or countries), decayed to now. */
    private Map<UUID, SparseVector> interests(Instant now) {
        Map<UUID, Map<String, Double>> raw = new HashMap<>();
        jdbc.sql("""
                SELECT a.user_id, a.key, a.score, a.updated_at FROM user_affinities a
                JOIN (SELECT user_id FROM user_affinities WHERE updated_at > :since
                      GROUP BY user_id ORDER BY max(updated_at) DESC LIMIT :max) active ON active.user_id = a.user_id
                WHERE a.key NOT LIKE :author AND a.key NOT LIKE :country
                """).param("since", Timestamp.from(now.minus(Duration.ofDays(ACTIVE_DAYS)))).param("max", MAX_PEOPLE)
                .param("author", SignalUpdater.AUTHOR_PREFIX + "%").param("country", SignalUpdater.COUNTRY_PREFIX + "%")
                .query((rs, row) -> raw.computeIfAbsent(rs.getObject("user_id", UUID.class), id -> new HashMap<>())
                        .put(rs.getString("key"), updater.decayed(rs.getDouble("score"), rs.getTimestamp("updated_at").toInstant(), now)))
                .list();
        Map<UUID, SparseVector> result = new HashMap<>();
        raw.forEach((person, weights) -> {
            SparseVector vector = SparseVector.of(weights);
            if (!vector.isEmpty()) result.put(person, vector);
        });
        return result;
    }
}
