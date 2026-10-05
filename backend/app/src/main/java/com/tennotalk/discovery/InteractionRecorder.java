package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.tennotalk.common.Interaction;
import com.tennotalk.discovery.DiscoverDtos.EventInput;
import com.tennotalk.feed.Visibility;
import com.tennotalk.recommender.learning.InteractionKind;
import com.tennotalk.recommender.learning.SignalUpdater;

/**
 * Writes interaction events (PLAN.md §37.5). Recording a signal never breaks the action that caused it:
 * service interactions are written after their transaction commits, and a failure is only logged.
 */
@Component
public class InteractionRecorder {

    private static final Logger log = LoggerFactory.getLogger(InteractionRecorder.class);

    /** What a client may report; the rest comes from the services, so a client cannot forge likes. */
    static final Set<InteractionKind> CLIENT_KINDS = Set.of(InteractionKind.IMPRESSION, InteractionKind.DWELL,
            InteractionKind.SHARE, InteractionKind.PROFILE_OPEN, InteractionKind.HIDE_POST, InteractionKind.HIDE_AUTHOR);
    private static final Set<InteractionKind> SERVICE_KINDS = Set.of(InteractionKind.LIKE, InteractionKind.UNLIKE,
            InteractionKind.COMMENT, InteractionKind.FOLLOW, InteractionKind.UNFOLLOW, InteractionKind.REPORT);
    private static final Duration MAX_CLIENT_DELAY = Duration.ofDays(1);

    private record Valid(String clientId, UUID postId, InteractionKind kind, long value, Instant at) {}

    private final JdbcClient jdbc;
    private final Clock clock;

    public InteractionRecorder(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Interactions published by the services (likes, comments, follows, reports). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onInteraction(Interaction interaction) {
        try {
            Optional<InteractionKind> kind = InteractionKind.fromCode(interaction.kind());
            if (kind.isEmpty() || !SERVICE_KINDS.contains(kind.get())) return;
            if (interaction.userId() == null || interaction.authorId() == null || interaction.userId().equals(interaction.authorId())) return;
            insert(interaction.userId(), interaction.postId(), interaction.authorId(), kind.get(), 0, null, clock.instant());
        } catch (RuntimeException failure) {
            log.warn("Discover signal not recorded ({} by {}): {}", interaction.kind(), interaction.userId(), failure.toString());
        }
    }

    /**
     * Events reported by a client. Invalid entries (unknown kind, malformed or invisible post) are skipped, not
     * fatal: one bad event never drops the batch. Repeated client ids are ignored.
     */
    @Transactional
    public int recordFromClient(UUID viewer, List<EventInput> events) {
        Instant now = clock.instant();
        Map<String, Valid> valid = new java.util.LinkedHashMap<>();
        for (EventInput event : events) parse(event, now).ifPresent(v -> valid.putIfAbsent(v.clientId(), v));
        if (valid.isEmpty()) return 0;
        Map<UUID, UUID> authors = visibleAuthors(viewer, valid.values().stream().map(Valid::postId).toList());
        int recorded = 0;
        for (Valid event : valid.values()) {
            UUID author = authors.get(event.postId());
            if (author == null || author.equals(viewer)) continue;
            if (insert(viewer, event.postId(), author, event.kind(), event.value(), event.clientId(), event.at())) recorded++;
            if (event.kind() == InteractionKind.HIDE_POST) hidePost(viewer, event.postId());
            if (event.kind() == InteractionKind.HIDE_AUTHOR) hideAuthor(viewer, author);
        }
        return recorded;
    }

    @Transactional
    public void unhidePost(UUID viewer, UUID post) {
        jdbc.sql("DELETE FROM hidden_posts WHERE user_id = :u AND post_id = :p").param("u", viewer).param("p", post).update();
    }

    @Transactional
    public void unhideAuthor(UUID viewer, UUID author) {
        jdbc.sql("DELETE FROM hidden_authors WHERE user_id = :u AND author_id = :a").param("u", viewer).param("a", author).update();
    }

    private Optional<Valid> parse(EventInput event, Instant now) {
        if (event == null || event.clientId() == null || event.clientId().isBlank()) return Optional.empty();
        Optional<InteractionKind> kind = InteractionKind.fromCode(event.kind());
        if (kind.isEmpty() || !CLIENT_KINDS.contains(kind.get())) return Optional.empty();
        UUID post;
        try {
            post = UUID.fromString(event.postId());
        } catch (RuntimeException malformed) {
            return Optional.empty();
        }
        long value = kind.get() == InteractionKind.DWELL && event.value() != null
                ? Math.clamp(event.value(), 0, SignalUpdater.MAX_DWELL_MS) : 0;
        Instant at = event.at() == null || event.at().isAfter(now) || event.at().isBefore(now.minus(MAX_CLIENT_DELAY)) ? now : event.at();
        return Optional.of(new Valid(event.clientId().strip(), post, kind.get(), value, at));
    }

    private Map<UUID, UUID> visibleAuthors(UUID viewer, List<UUID> posts) {
        Map<UUID, UUID> authors = new HashMap<>();
        jdbc.sql("SELECT p.id, p.author_id FROM posts p WHERE p.id IN (:ids) AND " + Visibility.authorVisible("p.author_id"))
                .param("ids", new LinkedHashSet<>(posts)).param("viewer", viewer)
                .query((rs, row) -> authors.put(rs.getObject("id", UUID.class), rs.getObject("author_id", UUID.class))).list();
        return authors;
    }

    private boolean insert(UUID user, UUID post, UUID author, InteractionKind kind, long value, String clientId, Instant at) {
        return jdbc.sql("""
                INSERT INTO interaction_events (user_id, post_id, author_id, kind, value, client_id, occurred_at)
                VALUES (:u, :p, :a, :k, :v, :c, :at)
                ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
                """).param("u", user).param("p", post).param("a", author).param("k", kind.code()).param("v", value)
                .param("c", clientId).param("at", Timestamp.from(at)).update() > 0;
    }

    private void hidePost(UUID viewer, UUID post) {
        jdbc.sql("INSERT INTO hidden_posts (user_id, post_id) VALUES (:u, :p) ON CONFLICT DO NOTHING")
                .param("u", viewer).param("p", post).update();
    }

    private void hideAuthor(UUID viewer, UUID author) {
        jdbc.sql("INSERT INTO hidden_authors (user_id, author_id) VALUES (:u, :a) ON CONFLICT DO NOTHING")
                .param("u", viewer).param("a", author).update();
    }
}
