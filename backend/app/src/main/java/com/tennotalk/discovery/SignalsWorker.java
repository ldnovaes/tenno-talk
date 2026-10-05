package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.tennotalk.recommender.SparseVector;
import com.tennotalk.recommender.learning.InteractionKind;
import com.tennotalk.recommender.learning.SignalUpdater;
import com.tennotalk.recommender.learning.StatsDelta;

/**
 * Folds interaction events into post counters and learned interests (PLAN.md §37.5). Exactly once: an event is
 * marked processed in the same transaction that applies it. A batch that fails is retried one event at a time,
 * and an event that still fails is marked and skipped, so a bad row never blocks the queue.
 */
@Component
public class SignalsWorker {

    private static final Logger log = LoggerFactory.getLogger(SignalsWorker.class);

    private record Event(long id, UUID user, UUID post, UUID author, InteractionKind kind, long value, Instant at) {}

    private record Change(double delta, Instant at) {}

    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final SignalUpdater updater;
    private final DiscoverProperties properties;
    private final Clock clock;

    public SignalsWorker(JdbcClient jdbc, TransactionTemplate tx, SignalUpdater updater, DiscoverProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.updater = updater;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${tenno.discover.worker-interval:2s}")
    public void poll() {
        if (properties.workerEnabled()) runOnce();
    }

    /** Processes one batch; returns how many events were handled (tests call it directly). */
    public int runOnce() {
        try {
            Integer handled = tx.execute(status -> fold(claimBatch()));
            return handled == null ? 0 : handled;
        } catch (RuntimeException batchFailure) {
            log.warn("Discover signals batch failed, retrying one by one: {}", batchFailure.toString());
            return oneByOne();
        }
    }

    private int oneByOne() {
        List<Long> pending = jdbc.sql("SELECT id FROM interaction_events WHERE processed_at IS NULL ORDER BY id LIMIT :n")
                .param("n", properties.workerBatch()).query(Long.class).list();
        int handled = 0;
        for (long id : pending) {
            try {
                Integer one = tx.execute(status -> fold(claimOne(id)));
                handled += one == null ? 0 : one;
            } catch (RuntimeException poison) {
                log.error("Discover signal event {} skipped: {}", id, poison.toString());
                tx.executeWithoutResult(status -> markProcessed(List.of(id)));
                handled++;
            }
        }
        return handled;
    }

    private static final String PENDING = """
            SELECT id, user_id, post_id, author_id, kind, value, occurred_at FROM interaction_events
            WHERE processed_at IS NULL
            """;

    private List<Event> claimBatch() {
        return jdbc.sql(PENDING + " ORDER BY id LIMIT :n FOR UPDATE SKIP LOCKED").param("n", properties.workerBatch())
                .query(SignalsWorker::event).list();
    }

    private List<Event> claimOne(long id) {
        return jdbc.sql(PENDING + " AND id = :id FOR UPDATE SKIP LOCKED").param("id", id).query(SignalsWorker::event).list();
    }

    private static Event event(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Event(rs.getLong("id"), rs.getObject("user_id", UUID.class), rs.getObject("post_id", UUID.class),
                rs.getObject("author_id", UUID.class), InteractionKind.fromCode(rs.getString("kind")).orElse(null),
                rs.getLong("value"), rs.getTimestamp("occurred_at").toInstant());
    }

    private int fold(List<Event> events) {
        if (events.isEmpty()) return 0;
        List<Event> known = events.stream().filter(e -> e.kind() != null).toList();
        Map<UUID, SparseVector> topics = topics(known.stream().map(Event::post).filter(java.util.Objects::nonNull).toList());
        Map<UUID, String> countries = countries(known.stream().map(Event::author).toList());
        applyStats(known);
        applyAffinities(known, topics, countries);
        markProcessed(events.stream().map(Event::id).toList());
        return events.size();
    }

    private void applyStats(List<Event> events) {
        Map<UUID, long[]> totals = new LinkedHashMap<>();
        for (Event event : events) {
            if (event.post() == null) continue;
            StatsDelta delta = SignalUpdater.statsDelta(event.kind(), event.value());
            if (delta.isNone()) continue;
            long[] sum = totals.computeIfAbsent(event.post(), post -> new long[6]);
            sum[0] += delta.impressions();
            sum[1] += delta.likes();
            sum[2] += delta.comments();
            sum[3] += delta.shares();
            sum[4] += delta.hides();
            sum[5] += delta.dwellMs();
        }
        Timestamp now = Timestamp.from(clock.instant());
        totals.forEach((post, sum) -> jdbc.sql("""
                INSERT INTO post_stats (post_id, impressions, likes, comments, shares, hides, dwell_ms_sum, updated_at)
                VALUES (:p, GREATEST(0, :i), GREATEST(0, :l), GREATEST(0, :c), GREATEST(0, :s), GREATEST(0, :h), GREATEST(0, :d), :now)
                ON CONFLICT (post_id) DO UPDATE SET
                    impressions = GREATEST(0, post_stats.impressions + :i), likes = GREATEST(0, post_stats.likes + :l),
                    comments = GREATEST(0, post_stats.comments + :c), shares = GREATEST(0, post_stats.shares + :s),
                    hides = GREATEST(0, post_stats.hides + :h), dwell_ms_sum = GREATEST(0, post_stats.dwell_ms_sum + :d),
                    updated_at = :now
                """).param("p", post).param("i", sum[0]).param("l", sum[1]).param("c", sum[2]).param("s", sum[3])
                .param("h", sum[4]).param("d", sum[5]).param("now", now).update());
    }

    private void applyAffinities(List<Event> events, Map<UUID, SparseVector> topics, Map<UUID, String> countries) {
        Map<UUID, Map<String, List<Change>>> byUser = new LinkedHashMap<>();
        for (Event event : events) {
            SparseVector postTopics = event.post() == null ? SparseVector.EMPTY : topics.getOrDefault(event.post(), SparseVector.EMPTY);
            SignalUpdater.affinityDeltas(event.kind(), event.value(), postTopics, event.author(), countries.get(event.author()))
                    .forEach((key, delta) -> byUser.computeIfAbsent(event.user(), user -> new LinkedHashMap<>())
                            .computeIfAbsent(key, k -> new ArrayList<>()).add(new Change(delta, event.at())));
        }
        byUser.forEach((user, changes) -> {
            record Stored(double score, Instant updatedAt) {}
            Map<String, Stored> stored = new HashMap<>();
            jdbc.sql("SELECT key, score, updated_at FROM user_affinities WHERE user_id = :u AND key IN (:keys) FOR UPDATE")
                    .param("u", user).param("keys", changes.keySet())
                    .query((rs, row) -> stored.put(rs.getString("key"), new Stored(rs.getDouble("score"), rs.getTimestamp("updated_at").toInstant())))
                    .list();
            changes.forEach((key, list) -> {
                Stored current = stored.getOrDefault(key, new Stored(0, null));
                double score = current.score();
                Instant at = current.updatedAt();
                for (Change change : list.stream().sorted(Comparator.comparing(Change::at)).toList()) {
                    score = updater.apply(score, at, change.delta(), change.at());
                    at = SignalUpdater.storedAt(at, change.at());
                }
                jdbc.sql("""
                        INSERT INTO user_affinities (user_id, key, score, updated_at) VALUES (:u, :k, :s, :at)
                        ON CONFLICT (user_id, key) DO UPDATE SET score = :s, updated_at = :at
                        """).param("u", user).param("k", key).param("s", score).param("at", Timestamp.from(at)).update();
            });
        });
    }

    private Map<UUID, SparseVector> topics(List<UUID> posts) {
        if (posts.isEmpty()) return Map.of();
        Map<UUID, Map<String, Double>> raw = new HashMap<>();
        jdbc.sql("SELECT post_id, topic, sum(weight) AS weight FROM post_topics WHERE post_id IN (:ids) GROUP BY post_id, topic")
                .param("ids", new HashSet<>(posts))
                .query((rs, row) -> raw.computeIfAbsent(rs.getObject("post_id", UUID.class), id -> new HashMap<>())
                        .put(rs.getString("topic"), rs.getDouble("weight")))
                .list();
        Map<UUID, SparseVector> result = new HashMap<>();
        raw.forEach((post, weights) -> result.put(post, SparseVector.of(weights)));
        return result;
    }

    private Map<UUID, String> countries(List<UUID> authors) {
        if (authors.isEmpty()) return Map.of();
        Map<UUID, String> result = new HashMap<>();
        jdbc.sql("SELECT id, country FROM users WHERE id IN (:ids)").param("ids", new HashSet<>(authors))
                .query((rs, row) -> result.put(rs.getObject("id", UUID.class), rs.getString("country"))).list();
        return result;
    }

    private void markProcessed(List<Long> ids) {
        jdbc.sql("UPDATE interaction_events SET processed_at = :now WHERE id IN (:ids)")
                .param("now", Timestamp.from(clock.instant())).param("ids", ids).update();
    }
}
