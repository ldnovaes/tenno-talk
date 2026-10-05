package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.tennotalk.recommender.Viewer;
import com.tennotalk.recommender.learning.SignalUpdater;

/**
 * Everything known about the viewer, for the ranking (PLAN.md §37.6). Each part is loaded on its own; a part
 * that fails is left empty (the ranking degrades) except the hidden lists, which the candidate query also
 * enforces.
 */
@Component
class ViewerLoader {

    static final Duration SEEN_WINDOW = Duration.ofDays(7);
    private static final int MAX_SECOND_DEGREE = 1_000;
    private static final int MAX_NEIGHBOR_POSTS = 500;

    private record Profile(String nativeLanguage, List<String> learning, String receiving, String country) {
        static final Profile EMPTY = new Profile("", List.of(), "", "");
    }

    private final DiscoverReads reads;
    private final SignalUpdater updater;
    private final DiscoverProperties properties;

    ViewerLoader(DiscoverReads reads, SignalUpdater updater, DiscoverProperties properties) {
        this.reads = reads;
        this.updater = updater;
        this.properties = properties;
    }

    Viewer load(UUID viewer, Instant now) {
        Profile profile = reads.attempt("viewer.profile", () -> profile(viewer), Profile.EMPTY);
        Map<String, Double> affinities = reads.attempt("viewer.affinities", () -> affinities(viewer, now), Map.of());
        Map<String, Double> topics = new HashMap<>();
        Map<UUID, Double> authors = new HashMap<>();
        Map<String, Double> countries = new HashMap<>();
        affinities.forEach((key, score) -> {
            if (key.startsWith(SignalUpdater.AUTHOR_PREFIX)) {
                parse(key.substring(SignalUpdater.AUTHOR_PREFIX.length())).ifPresent(author -> authors.put(author, score));
            } else if (key.startsWith(SignalUpdater.COUNTRY_PREFIX)) {
                countries.put(key.substring(SignalUpdater.COUNTRY_PREFIX.length()), score);
            } else {
                topics.put(key, score);
            }
        });
        return Viewer.builder(viewer)
                .nativeLanguage(profile.nativeLanguage()).learningLanguages(profile.learning())
                .receivingLanguage(profile.receiving()).country(profile.country())
                .topics(topics).authors(authors).countries(countries)
                .following(reads.attempt("viewer.following", () -> ids("SELECT followee_id FROM follows WHERE follower_id = :v", viewer), List.of()))
                .secondDegree(reads.attempt("viewer.secondDegree", () -> secondDegree(viewer), List.of()))
                .chatPartners(reads.attempt("viewer.chatPartners", () -> chatPartners(viewer), List.of()))
                .neighborEngagement(reads.attempt("viewer.neighbors", () -> neighborEngagement(viewer, now), Map.of()))
                .seen(reads.attempt("viewer.seen", () -> seen(viewer, now), List.of()))
                .hiddenPosts(reads.attempt("viewer.hiddenPosts", () -> ids("SELECT post_id FROM hidden_posts WHERE user_id = :v", viewer), List.of()))
                .hiddenAuthors(reads.attempt("viewer.hiddenAuthors", () -> ids("SELECT author_id FROM hidden_authors WHERE user_id = :v", viewer), List.of()))
                .build();
    }

    private Profile profile(UUID viewer) {
        return reads.jdbc.sql("""
                SELECT u.native_language, u.learning_languages, u.country, p.receiving_language
                FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id WHERE u.id = :v
                """).param("v", viewer)
                .query((rs, row) -> new Profile(rs.getString("native_language"), DiscoverReads.strings(rs.getArray("learning_languages")),
                        rs.getString("receiving_language"), rs.getString("country")))
                .optional().orElse(Profile.EMPTY);
    }

    /** Learned affinities, decayed to now. */
    private Map<String, Double> affinities(UUID viewer, Instant now) {
        Map<String, Double> result = new HashMap<>();
        reads.jdbc.sql("SELECT key, score, updated_at FROM user_affinities WHERE user_id = :v").param("v", viewer)
                .query((rs, row) -> result.put(rs.getString("key"),
                        updater.decayed(rs.getDouble("score"), rs.getTimestamp("updated_at").toInstant(), now)))
                .list();
        return result;
    }

    private List<UUID> secondDegree(UUID viewer) {
        return reads.jdbc.sql("""
                SELECT DISTINCT f2.followee_id FROM follows f1 JOIN follows f2 ON f2.follower_id = f1.followee_id
                WHERE f1.follower_id = :v AND f2.followee_id <> :v LIMIT :limit
                """).param("v", viewer).param("limit", MAX_SECOND_DEGREE).query(UUID.class).list();
    }

    private List<UUID> chatPartners(UUID viewer) {
        return reads.jdbc.sql("""
                SELECT DISTINCT o.user_id FROM conversation_members m
                JOIN conversations c ON c.id = m.conversation_id AND c.kind = 'direct'
                JOIN conversation_members o ON o.conversation_id = m.conversation_id AND o.user_id <> :v
                WHERE m.user_id = :v
                """).param("v", viewer).query(UUID.class).list();
    }

    /** Posts that people with similar interests engaged with recently, weighted by similarity. */
    private Map<UUID, Double> neighborEngagement(UUID viewer, Instant now) {
        Map<UUID, Double> result = new HashMap<>();
        reads.jdbc.sql("""
                SELECT e.post_id, sum(n.similarity * CASE e.kind WHEN 'share' THEN 2 WHEN 'comment' THEN 1.5 WHEN 'like' THEN 1 ELSE 0.5 END) AS weight
                FROM user_neighbors n JOIN interaction_events e ON e.user_id = n.neighbor_id
                WHERE n.user_id = :v AND e.post_id IS NOT NULL AND e.occurred_at > :since
                  AND (e.kind IN ('like', 'comment', 'share') OR (e.kind = 'dwell' AND e.value >= :dwell))
                GROUP BY e.post_id ORDER BY weight DESC LIMIT :limit
                """).param("v", viewer).param("since", Timestamp.from(now.minus(properties.window())))
                .param("dwell", SignalUpdater.FULL_DWELL_MS).param("limit", MAX_NEIGHBOR_POSTS)
                .query((rs, row) -> result.put(rs.getObject("post_id", UUID.class), rs.getDouble("weight"))).list();
        return result;
    }

    private List<UUID> seen(UUID viewer, Instant now) {
        return reads.jdbc.sql("""
                SELECT DISTINCT post_id FROM interaction_events
                WHERE user_id = :v AND kind = 'impression' AND post_id IS NOT NULL AND occurred_at > :since
                """).param("v", viewer).param("since", Timestamp.from(now.minus(SEEN_WINDOW))).query(UUID.class).list();
    }

    private List<UUID> ids(String sql, UUID viewer) {
        return reads.jdbc.sql(sql).param("v", viewer).query(UUID.class).list();
    }

    private static java.util.Optional<UUID> parse(String value) {
        try {
            return java.util.Optional.of(UUID.fromString(value));
        } catch (IllegalArgumentException malformed) {
            return java.util.Optional.empty();
        }
    }
}
