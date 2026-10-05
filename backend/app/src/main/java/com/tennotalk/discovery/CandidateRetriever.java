package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.tennotalk.feed.Visibility;
import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.PostStats;
import com.tennotalk.recommender.Viewer;

/**
 * Candidate posts for a viewer (PLAN.md §37.6). Independent sources, each with its own query and failure
 * isolation, are interleaved round-robin (under-exposed first) up to the candidate limit. Every source applies
 * visibility, the viewer's hidden lists and the time window.
 */
@Component
class CandidateRetriever {

    /** What came back, and whether any source answered at all (none answering is an outage, not an empty feed). */
    record Result(List<Candidate> candidates, int sourcesAnswered) {}

    private static final int MAX_LIST_PARAM = 300;

    private final DiscoverReads reads;
    private final DiscoverProperties properties;

    CandidateRetriever(DiscoverReads reads, DiscoverProperties properties) {
        this.reads = reads;
        this.properties = properties;
    }

    Result retrieve(Viewer viewer, Instant now, Set<UUID> exclude) {
        List<List<UUID>> sources = new ArrayList<>();
        int[] answered = {0};
        java.util.function.BiConsumer<String, java.util.function.Supplier<List<UUID>>> source = (name, query) -> {
            List<UUID> ids = reads.attempt("source." + name, query, null);
            if (ids != null) {
                answered[0]++;
                sources.add(ids);
            }
        };
        source.accept("underExposed", () -> underExposed(viewer, now));
        source.accept("fresh", () -> select(viewer, now, "TRUE", Map.of(), "p.created_at DESC"));
        source.accept("language", () -> language(viewer, now));
        source.accept("topics", () -> topics(viewer, now));
        source.accept("authors", () -> byAuthors(viewer, now, closeAuthors(viewer)));
        source.accept("secondDegree", () -> byAuthors(viewer, now, limit(viewer.secondDegree())));
        source.accept("neighbors", () -> neighborPosts(viewer, now));
        source.accept("popular", () -> select(viewer, now, "TRUE", Map.of(),
                "(coalesce(s.likes, 0) + 2 * coalesce(s.comments, 0) + 3 * coalesce(s.shares, 0) + 1.0) / (coalesce(s.impressions, 0) + 20) DESC, p.created_at DESC"));

        List<UUID> ids = interleave(sources, exclude, properties.candidateLimit());
        List<Candidate> candidates = ids.isEmpty() ? List.of() : reads.attempt("candidates.details", () -> details(ids), List.of());
        return new Result(candidates, answered[0]);
    }

    /** Round-robin over the sources, skipping repeats and excluded posts, up to {@code limit}. */
    static List<UUID> interleave(List<List<UUID>> sources, Set<UUID> exclude, int limit) {
        LinkedHashSet<UUID> result = new LinkedHashSet<>();
        int longest = sources.stream().mapToInt(List::size).max().orElse(0);
        for (int i = 0; i < longest && result.size() < limit; i++) {
            for (List<UUID> source : sources) {
                if (i < source.size() && !exclude.contains(source.get(i))) result.add(source.get(i));
                if (result.size() >= limit) break;
            }
        }
        return new ArrayList<>(result);
    }

    // ---- sources ---------------------------------------------------------------

    private List<UUID> underExposed(Viewer viewer, Instant now) {
        var config = properties.recommenderConfig();
        Instant since = now.minus(config.exposureWindow());
        return select(viewer, now, "coalesce(s.impressions, 0) < :minImpressions AND p.created_at > :exposureSince",
                Map.of("minImpressions", config.minImpressions(), "exposureSince", Timestamp.from(since)),
                "coalesce(s.impressions, 0), p.created_at");
    }

    private List<UUID> language(Viewer viewer, Instant now) {
        if (viewer.learningLanguages().isEmpty()) return List.of();
        return select(viewer, now, """
                (split_part(lower(coalesce(p.caption_language, '')), '-', 1) IN (:learning)
                 OR split_part(lower(a.native_language), '-', 1) IN (:learning))""",
                Map.of("learning", viewer.learningLanguages()), "p.created_at DESC");
    }

    private List<UUID> topics(Viewer viewer, Instant now) {
        List<String> top = viewer.topics().weights().entrySet().stream().filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed()).limit(20).map(Map.Entry::getKey).toList();
        if (top.isEmpty()) return List.of();
        return select(viewer, now, "EXISTS (SELECT 1 FROM post_topics t WHERE t.post_id = p.id AND t.topic IN (:topics))",
                Map.of("topics", top), "p.created_at DESC");
    }

    /** Followed, chatted with, and authors the viewer likes: the people closest to them. */
    private static List<UUID> closeAuthors(Viewer viewer) {
        LinkedHashSet<UUID> authors = new LinkedHashSet<>();
        viewer.authors().entrySet().stream().filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed()).limit(100).forEach(e -> authors.add(e.getKey()));
        authors.addAll(viewer.following());
        authors.addAll(viewer.chatPartners());
        return limit(authors);
    }

    private List<UUID> byAuthors(Viewer viewer, Instant now, List<UUID> authors) {
        if (authors.isEmpty()) return List.of();
        return select(viewer, now, "p.author_id IN (:authors)", Map.of("authors", authors), "p.created_at DESC");
    }

    private List<UUID> neighborPosts(Viewer viewer, Instant now) {
        List<UUID> posts = viewer.neighborEngagement().entrySet().stream()
                .sorted(Map.Entry.<UUID, Double>comparingByValue().reversed()).map(Map.Entry::getKey).limit(MAX_LIST_PARAM).toList();
        if (posts.isEmpty()) return List.of();
        return select(viewer, now, "p.id IN (:posts)", Map.of("posts", posts), "p.created_at DESC");
    }

    private List<UUID> select(Viewer viewer, Instant now, String condition, Map<String, ?> params, String order) {
        return reads.jdbc.sql("""
                SELECT p.id FROM posts p
                JOIN users a ON a.id = p.author_id
                LEFT JOIN post_stats s ON s.post_id = p.id
                WHERE p.created_at > :since AND p.author_id <> :viewer
                  AND NOT EXISTS (SELECT 1 FROM hidden_posts h WHERE h.user_id = :viewer AND h.post_id = p.id)
                  AND NOT EXISTS (SELECT 1 FROM hidden_authors h WHERE h.user_id = :viewer AND h.author_id = p.author_id)
                  AND %s AND %s
                ORDER BY %s LIMIT :limit
                """.formatted(Visibility.authorVisible("p.author_id"), condition, order))
                .param("viewer", viewer.id()).param("since", Timestamp.from(now.minus(properties.window())))
                .param("limit", properties.sourceLimit()).params(params)
                .query(UUID.class).list();
    }

    // ---- details ---------------------------------------------------------------

    private List<Candidate> details(List<UUID> ids) {
        Map<UUID, Map<String, Double>> topics = new HashMap<>();
        reads.jdbc.sql("SELECT post_id, topic, sum(weight) AS weight FROM post_topics WHERE post_id IN (:ids) GROUP BY post_id, topic")
                .param("ids", ids)
                .query((rs, row) -> topics.computeIfAbsent(rs.getObject("post_id", UUID.class), id -> new HashMap<>())
                        .put(rs.getString("topic"), rs.getDouble("weight")))
                .list();
        Map<UUID, Candidate> byId = new LinkedHashMap<>();
        reads.jdbc.sql("""
                SELECT p.id, p.author_id, p.created_at, p.caption_language, a.native_language, a.learning_languages, a.country,
                       s.impressions, s.likes, s.comments, s.shares, s.hides, s.dwell_ms_sum
                FROM posts p JOIN users a ON a.id = p.author_id LEFT JOIN post_stats s ON s.post_id = p.id
                WHERE p.id IN (:ids)
                """).param("ids", ids).query((rs, row) -> {
            UUID id = rs.getObject("id", UUID.class);
            byId.put(id, Candidate.builder(id, rs.getObject("author_id", UUID.class))
                    .createdAt(rs.getTimestamp("created_at").toInstant())
                    .language(rs.getString("caption_language"))
                    .authorNativeLanguage(rs.getString("native_language"))
                    .authorLearningLanguages(DiscoverReads.strings(rs.getArray("learning_languages")))
                    .authorCountry(rs.getString("country"))
                    .topics(topics.getOrDefault(id, Map.of()))
                    .stats(new PostStats(rs.getLong("impressions"), rs.getLong("likes"), rs.getLong("comments"), rs.getLong("shares"),
                            rs.getLong("hides"), rs.getLong("dwell_ms_sum")))
                    .build());
            return null;
        }).list();
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    private static List<UUID> limit(Collection<UUID> ids) {
        return ids.stream().limit(MAX_LIST_PARAM).toList();
    }
}
