package com.tennotalk.feed;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.chat.ChatDtos.OriginalTextDto;
import com.tennotalk.common.ApiException;
import com.tennotalk.common.Cursor;
import com.tennotalk.common.Ids;
import com.tennotalk.common.Languages;
import com.tennotalk.common.PageDto;
import com.tennotalk.feed.FeedDtos.CommentDto;
import com.tennotalk.feed.FeedDtos.PostDto;
import com.tennotalk.media.MediaRepository;
import com.tennotalk.media.MediaRow;
import com.tennotalk.notifications.NotificationService;
import com.tennotalk.notifications.NotificationService.Target;
import com.tennotalk.translation.ContentSource;
import com.tennotalk.translation.ContentTranslationRepository;
import com.tennotalk.users.PreferencesRepository;
import com.tennotalk.users.SocialGraph;
import com.tennotalk.users.UserDtos.UserDto;
import com.tennotalk.users.UserRepository;
import com.tennotalk.users.UserRow;

@Service
public class FeedService {

    private static final int PAGE_SIZE = 10;

    private record PostRow(UUID id, UUID authorId, String captionText, String captionLanguage, Instant createdAt) {}

    private final JdbcClient jdbc;
    private final MediaRepository media;
    private final UserRepository users;
    private final PreferencesRepository preferences;
    private final SocialGraph graph;
    private final ContentTranslationRepository translations;
    private final NotificationService notifications;
    private final Clock clock;

    public FeedService(JdbcClient jdbc, MediaRepository media, UserRepository users, PreferencesRepository preferences,
            SocialGraph graph, ContentTranslationRepository translations, NotificationService notifications, Clock clock) {
        this.jdbc = jdbc;
        this.media = media;
        this.users = users;
        this.preferences = preferences;
        this.graph = graph;
        this.translations = translations;
        this.notifications = notifications;
        this.clock = clock;
    }

    private static PostRow post(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new PostRow(rs.getObject("id", UUID.class), rs.getObject("author_id", UUID.class), rs.getString("caption_text"),
                rs.getString("caption_language"), rs.getTimestamp("created_at").toInstant());
    }

    // ---- reading ---------------------------------------------------------

    @Transactional(readOnly = true)
    public PageDto<PostDto> feed(UUID viewer, String cursor) {
        return page(viewer, cursor, "TRUE", Map.of());
    }

    @Transactional(readOnly = true)
    public PageDto<PostDto> byUser(UUID viewer, UUID author, String cursor) {
        return page(viewer, cursor, "p.author_id = :author", Map.of("author", author));
    }

    private PageDto<PostDto> page(UUID viewer, String cursor, String filter, Map<String, ?> params) {
        Cursor after = Cursor.decodeOrNull(cursor);
        List<PostRow> rows = jdbc.sql("""
                SELECT p.* FROM posts p
                WHERE %s AND %s
                AND (CAST(:at AS timestamptz) IS NULL OR (p.created_at, p.id) < (:at, :id))
                ORDER BY p.created_at DESC, p.id DESC LIMIT :limit
                """.formatted(filter, Visibility.authorVisible("p.author_id")))
                .param("viewer", viewer)
                .params(params)
                .param("at", after == null ? null : Timestamp.from(after.createdAt()))
                .param("id", after == null ? null : after.id())
                .param("limit", PAGE_SIZE + 1)
                .query(FeedService::post)
                .list();
        boolean more = rows.size() > PAGE_SIZE;
        List<PostRow> page = more ? rows.subList(0, PAGE_SIZE) : rows;
        String next = more ? new Cursor(page.getLast().createdAt(), page.getLast().id()).encode() : null;
        return new PageDto<>(project(viewer, page), next);
    }

    @Transactional(readOnly = true)
    public PostDto get(UUID viewer, UUID postId) {
        return project(viewer, List.of(visiblePost(viewer, postId))).getFirst();
    }

    private PostRow visiblePost(UUID viewer, UUID postId) {
        return jdbc.sql("SELECT p.* FROM posts p WHERE p.id = :post AND " + Visibility.authorVisible("p.author_id"))
                .param("post", postId).param("viewer", viewer)
                .query(FeedService::post).optional()
                .orElseThrow(() -> ApiException.notFound("Post not found."));
    }

    boolean isVisible(UUID viewer, UUID postId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM posts p WHERE p.id = :post AND " + Visibility.authorVisible("p.author_id") + ")")
                .param("post", postId).param("viewer", viewer).query(Boolean.class).single();
    }

    Optional<OriginalTextDto> captionFor(UUID viewer, UUID postId) {
        try {
            PostRow row = visiblePost(viewer, postId);
            return row.captionText() == null ? Optional.empty() : Optional.of(new OriginalTextDto(row.captionText(), row.captionLanguage()));
        } catch (ApiException notVisible) {
            return Optional.empty();
        }
    }

    private List<PostDto> project(UUID viewer, List<PostRow> rows) {
        if (rows.isEmpty()) return List.of();
        List<UUID> ids = rows.stream().map(PostRow::id).toList();
        Map<UUID, List<MediaRow>> mediaByPost = media.forPosts(ids);
        String language = preferences.receivingLanguage(viewer);
        Map<UUID, ContentTranslationDto> translated = translations.findMany("post", ids, language);
        Map<UUID, UserDto> authors = authors(rows.stream().map(PostRow::authorId).toList());
        Map<UUID, long[]> counts = new HashMap<>();
        jdbc.sql("""
                SELECT p.id,
                       (SELECT count(*) FROM likes l WHERE l.post_id = p.id) AS likes,
                       (SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comments,
                       EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = :viewer) AS liked
                FROM posts p WHERE p.id IN (:ids)
                """).param("ids", ids).param("viewer", viewer).query((rs, row) -> {
            counts.put(rs.getObject("id", UUID.class), new long[] {rs.getLong("likes"), rs.getLong("comments"), rs.getBoolean("liked") ? 1 : 0});
            return null;
        }).list();
        List<PostDto> result = new ArrayList<>();
        for (PostRow row : rows) {
            long[] c = counts.getOrDefault(row.id(), new long[3]);
            OriginalTextDto caption = row.captionText() == null ? null : new OriginalTextDto(row.captionText(), row.captionLanguage());
            result.add(new PostDto(row.id(), authors.get(row.authorId()),
                    mediaByPost.getOrDefault(row.id(), List.of()).stream().map(MediaRow::toDto).toList(),
                    caption, translationOf(caption, translated.get(row.id()), language, row.createdAt()),
                    c[0], c[1], c[2] == 1, row.createdAt()));
        }
        return result;
    }

    static ContentTranslationDto translationOf(OriginalTextDto original, ContentTranslationDto cached, String language, Instant at) {
        if (original == null) return null;
        if (Languages.same(original.language(), language)) return new ContentTranslationDto(language, null, "not_needed", 0, at);
        return cached;
    }

    private Map<UUID, UserDto> authors(List<UUID> ids) {
        Map<UUID, UserDto> result = new HashMap<>();
        if (ids.isEmpty()) return result;
        jdbc.sql("SELECT id, username, display_name, avatar_url FROM users WHERE id IN (:ids)").param("ids", new LinkedHashSet<>(ids))
                .query((rs, row) -> {
                    String username = rs.getString("username");
                    result.put(rs.getObject("id", UUID.class), new UserDto(rs.getObject("id", UUID.class),
                            username == null ? "" : username, rs.getString("display_name"), rs.getString("avatar_url")));
                    return null;
                }).list();
        return result;
    }

    // ---- writing ---------------------------------------------------------

    @Transactional
    public PostDto like(UUID viewer, UUID postId) {
        PostRow post = visiblePost(viewer, postId);
        int inserted = jdbc.sql("INSERT INTO likes (post_id, user_id) VALUES (:p, :u) ON CONFLICT DO NOTHING")
                .param("p", postId).param("u", viewer).update();
        if (inserted > 0) notifications.notify(post.authorId(), viewer, "like", Target.post(postId));
        return get(viewer, postId);
    }

    @Transactional
    public PostDto unlike(UUID viewer, UUID postId) {
        visiblePost(viewer, postId);
        jdbc.sql("DELETE FROM likes WHERE post_id = :p AND user_id = :u").param("p", postId).param("u", viewer).update();
        return get(viewer, postId);
    }

    @Transactional(readOnly = true)
    public List<CommentDto> comments(UUID viewer, UUID postId) {
        visiblePost(viewer, postId);
        String language = preferences.receivingLanguage(viewer);
        record CommentRow(UUID id, UUID authorId, String text, String language, Instant at) {}
        List<CommentRow> rows = jdbc.sql("""
                SELECT c.* FROM comments c WHERE c.post_id = :p
                AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = :viewer AND b.blocked_id = c.author_id)
                                                        OR (b.blocker_id = c.author_id AND b.blocked_id = :viewer))
                ORDER BY c.created_at, c.id
                """).param("p", postId).param("viewer", viewer)
                .query((rs, row) -> new CommentRow(rs.getObject("id", UUID.class), rs.getObject("author_id", UUID.class),
                        rs.getString("body_text"), rs.getString("body_language"), rs.getTimestamp("created_at").toInstant()))
                .list();
        Map<UUID, ContentTranslationDto> translated = translations.findMany("comment", rows.stream().map(CommentRow::id).toList(), language);
        Map<UUID, UserDto> authors = authors(rows.stream().map(CommentRow::authorId).toList());
        return rows.stream().map(row -> {
            OriginalTextDto body = new OriginalTextDto(row.text(), row.language());
            return new CommentDto(row.id(), postId, authors.get(row.authorId()), body,
                    translationOf(body, translated.get(row.id()), language, row.at()), row.at());
        }).toList();
    }

    /** "Who can comment" is enforced here, never only in the UI (PLAN.md §31). */
    @Transactional
    public CommentDto comment(UUID viewer, UUID postId, String text) {
        PostRow post = visiblePost(viewer, postId);
        String body = text == null ? "" : text.strip();
        if (body.isEmpty()) throw ApiException.validation("A comment can't be empty.");
        if (body.length() > 2000) throw ApiException.validation("A comment can be at most 2000 characters.");
        if (!post.authorId().equals(viewer)) {
            String audience = preferences.find(post.authorId()).privacy().whoCanComment();
            if ("nobody".equals(audience) || ("followers".equals(audience) && !graph.follows(post.authorId(), viewer))) {
                throw ApiException.forbidden("Comments are limited on this post.");
            }
        }
        UserRow author = users.require(viewer);
        UUID id = Ids.newId();
        jdbc.sql("INSERT INTO comments (id, post_id, author_id, body_text, body_language) VALUES (:id, :p, :a, :t, :l)")
                .param("id", id).param("p", postId).param("a", viewer).param("t", body).param("l", author.nativeLanguage())
                .update();
        notifications.notify(post.authorId(), viewer, "comment", Target.comment(postId, id));
        return comments(viewer, postId).stream().filter(c -> c.id().equals(id)).findFirst().orElseThrow();
    }

    @Transactional
    public PostDto create(UUID viewer, List<UUID> mediaIds, String caption) {
        List<UUID> ids = mediaIds == null ? List.of() : List.copyOf(new LinkedHashSet<>(mediaIds));
        if (ids.isEmpty()) throw ApiException.validation("Add at least one photo or video.");
        if (ids.size() > 10) throw ApiException.validation("A post can have at most 10 items.");
        List<MediaRow> owned = media.findOwned(viewer, ids);
        if (owned.size() != ids.size() || owned.stream().anyMatch(m -> !"image".equals(m.kind()) && !"video".equals(m.kind()))) {
            throw ApiException.validation("Posts accept only your own photos and videos.");
        }
        String text = caption == null || caption.isBlank() ? null : caption.strip();
        if (text != null && text.length() > 2200) throw ApiException.validation("The caption is too long.");
        UserRow author = users.require(viewer);
        UUID id = Ids.newId();
        jdbc.sql("INSERT INTO posts (id, author_id, caption_text, caption_language, created_at) VALUES (:id, :a, :t, :l, :at)")
                .param("id", id).param("a", viewer).param("t", text).param("l", text == null ? null : author.nativeLanguage())
                .param("at", Timestamp.from(clock.instant()))
                .update();
        for (int position = 0; position < ids.size(); position++) {
            jdbc.sql("INSERT INTO post_media (post_id, media_id, position) VALUES (:p, :m, :pos)")
                    .param("p", id).param("m", ids.get(position)).param("pos", position).update();
        }
        return get(viewer, id);
    }

    /** Captions for the translation layer. */
    @org.springframework.stereotype.Component
    static class PostCaptions implements ContentSource {
        private final FeedService feed;
        private final JdbcClient jdbc;

        PostCaptions(FeedService feed, JdbcClient jdbc) {
            this.feed = feed;
            this.jdbc = jdbc;
        }

        @Override
        public String kind() {
            return "post";
        }

        @Override
        public Optional<OriginalTextDto> originalFor(UUID viewer, UUID id) {
            return feed.captionFor(viewer, id);
        }

        @Override
        public Optional<OriginalTextDto> original(UUID id) {
            return jdbc.sql("SELECT caption_text, caption_language FROM posts WHERE id = :id AND caption_text IS NOT NULL")
                    .param("id", id)
                    .query((rs, row) -> new OriginalTextDto(rs.getString(1), rs.getString(2))).optional();
        }
    }

    @org.springframework.stereotype.Component
    static class CommentBodies implements ContentSource {
        private final FeedService feed;
        private final JdbcClient jdbc;

        CommentBodies(FeedService feed, JdbcClient jdbc) {
            this.feed = feed;
            this.jdbc = jdbc;
        }

        @Override
        public String kind() {
            return "comment";
        }

        @Override
        public Optional<OriginalTextDto> originalFor(UUID viewer, UUID id) {
            Optional<UUID> post = jdbc.sql("SELECT post_id FROM comments WHERE id = :id").param("id", id).query(UUID.class).optional();
            if (post.isEmpty() || !feed.isVisible(viewer, post.get())) return Optional.empty();
            return original(id);
        }

        @Override
        public Optional<OriginalTextDto> original(UUID id) {
            return jdbc.sql("SELECT body_text, body_language FROM comments WHERE id = :id").param("id", id)
                    .query((rs, row) -> new OriginalTextDto(rs.getString(1), rs.getString(2))).optional();
        }
    }
}
