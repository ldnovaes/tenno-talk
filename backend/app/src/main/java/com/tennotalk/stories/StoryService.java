package com.tennotalk.stories;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.chat.ChatDtos.OriginalTextDto;
import com.tennotalk.chat.ChatInputs.SendMessage;
import com.tennotalk.chat.ChatService;
import com.tennotalk.common.ApiException;
import com.tennotalk.common.Ids;
import com.tennotalk.common.Languages;
import com.tennotalk.feed.Visibility;
import com.tennotalk.media.MediaRepository;
import com.tennotalk.media.MediaRow;
import com.tennotalk.notifications.NotificationService;
import com.tennotalk.notifications.NotificationService.Target;
import com.tennotalk.stories.StoryDtos.ReplyResult;
import com.tennotalk.stories.StoryDtos.StoryDto;
import com.tennotalk.stories.StoryDtos.StoryTrayItemDto;
import com.tennotalk.translation.ContentSource;
import com.tennotalk.translation.ContentTranslationRepository;
import com.tennotalk.users.PreferencesRepository;
import com.tennotalk.users.UserDtos.UserDto;
import com.tennotalk.users.UserRepository;
import com.tennotalk.users.UserRow;

/** Stories live 24 hours (PLAN.md §34). */
@Service
public class StoryService {

    static final Duration LIFETIME = Duration.ofHours(24);

    private record StoryRow(UUID id, UUID authorId, UUID mediaId, String text, String language, Instant createdAt,
            Instant expiresAt, boolean viewed, String username, String displayName, String avatarUrl) {}

    private final JdbcClient jdbc;
    private final MediaRepository media;
    private final UserRepository users;
    private final PreferencesRepository preferences;
    private final ContentTranslationRepository translations;
    private final NotificationService notifications;
    private final ChatService chat;
    private final Clock clock;

    public StoryService(JdbcClient jdbc, MediaRepository media, UserRepository users, PreferencesRepository preferences,
            ContentTranslationRepository translations, NotificationService notifications, ChatService chat, Clock clock) {
        this.jdbc = jdbc;
        this.media = media;
        this.users = users;
        this.preferences = preferences;
        this.translations = translations;
        this.notifications = notifications;
        this.chat = chat;
        this.clock = clock;
    }

    private static StoryRow row(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        return new StoryRow(rs.getObject("id", UUID.class), rs.getObject("author_id", UUID.class), rs.getObject("media_id", UUID.class),
                rs.getString("overlay_text"), rs.getString("overlay_language"), rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant(), rs.getBoolean("viewed"), rs.getString("username"),
                rs.getString("display_name"), rs.getString("avatar_url"));
    }

    private static final String SELECT = """
            SELECT s.*, u.username, u.display_name, u.avatar_url,
                   EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = :viewer) AS viewed
            FROM stories s JOIN users u ON u.id = s.author_id
            WHERE s.expires_at > :now AND
            """ + Visibility.authorVisible("s.author_id");

    /** The viewer first, then authors with unseen stories, then the rest (most recent first). */
    @Transactional(readOnly = true)
    public List<StoryTrayItemDto> tray(UUID viewer) {
        List<StoryRow> rows = jdbc.sql(SELECT + " AND " + Visibility.followedAuthor("s.author_id") + " ORDER BY s.created_at, s.id")
                .param("viewer", viewer).param("now", Timestamp.from(clock.instant()))
                .query(StoryService::row).list();
        Map<UUID, List<StoryDto>> byAuthor = new LinkedHashMap<>();
        for (StoryDto story : project(viewer, rows)) {
            byAuthor.computeIfAbsent(story.author().id(), id -> new ArrayList<>()).add(story);
        }
        List<StoryTrayItemDto> items = new ArrayList<>();
        byAuthor.forEach((author, stories) -> items.add(new StoryTrayItemDto(stories.getFirst().author(), List.copyOf(stories),
                stories.stream().anyMatch(s -> !s.viewedByMe()))));
        items.sort(Comparator.<StoryTrayItemDto>comparingInt(item -> item.user().id().equals(viewer) ? 0 : item.hasUnseen() ? 1 : 2)
                .thenComparing(item -> item.stories().getLast().createdAt(), Comparator.reverseOrder()));
        return items;
    }

    @Transactional(readOnly = true)
    public List<StoryDto> byUser(UUID viewer, UUID author) {
        return project(viewer, jdbc.sql(SELECT + " AND s.author_id = :author ORDER BY s.created_at, s.id")
                .param("viewer", viewer).param("author", author).param("now", Timestamp.from(clock.instant()))
                .query(StoryService::row).list());
    }

    @Transactional(readOnly = true)
    public StoryDto get(UUID viewer, UUID id) {
        return project(viewer, List.of(require(viewer, id))).getFirst();
    }

    private Optional<StoryRow> find(UUID viewer, UUID storyId) {
        return jdbc.sql(SELECT + " AND s.id = :story")
                .param("viewer", viewer).param("now", Timestamp.from(clock.instant())).param("story", storyId)
                .query(StoryService::row).optional();
    }

    /** The overlay text, if the viewer can still see the story. */
    Optional<OriginalTextDto> overlayFor(UUID viewer, UUID storyId) {
        return find(viewer, storyId).filter(s -> s.text() != null).map(s -> new OriginalTextDto(s.text(), s.language()));
    }

    private StoryRow require(UUID viewer, UUID storyId) {
        return find(viewer, storyId).orElseThrow(() -> ApiException.notFound("This story is no longer available."));
    }

    private List<StoryDto> project(UUID viewer, List<StoryRow> rows) {
        if (rows.isEmpty()) return List.of();
        String language = preferences.receivingLanguage(viewer);
        Map<UUID, ContentTranslationDto> translated = translations.findMany("story", rows.stream().map(StoryRow::id).toList(), language);
        Map<UUID, MediaRow> files = new LinkedHashMap<>();
        media.findMany(rows.stream().map(StoryRow::mediaId).toList()).forEach(m -> files.put(m.id(), m));
        return rows.stream().map(row -> {
            OriginalTextDto overlay = row.text() == null ? null : new OriginalTextDto(row.text(), row.language());
            ContentTranslationDto translation = overlay == null ? null
                    : Languages.same(overlay.language(), language) ? new ContentTranslationDto(language, null, "not_needed", 0, row.createdAt())
                    : translated.get(row.id());
            UserDto author = new UserDto(row.authorId(), row.username() == null ? "" : row.username(), row.displayName(), row.avatarUrl());
            return new StoryDto(row.id(), author, files.get(row.mediaId()).toDto(), overlay, translation, row.createdAt(),
                    row.expiresAt(), row.viewed() || row.authorId().equals(viewer));
        }).toList();
    }

    @Transactional
    public void markViewed(UUID viewer, UUID storyId) {
        require(viewer, storyId);
        jdbc.sql("INSERT INTO story_views (story_id, user_id) VALUES (:s, :u) ON CONFLICT DO NOTHING")
                .param("s", storyId).param("u", viewer).update();
    }

    @Transactional
    public void react(UUID viewer, UUID storyId, String emoji) {
        StoryRow story = require(viewer, storyId);
        String value = emoji == null ? "" : emoji.strip();
        if (value.isEmpty() || value.length() > 16) throw ApiException.validation("Pick an emoji.");
        jdbc.sql("INSERT INTO story_reactions (story_id, user_id, emoji) VALUES (:s, :u, :e)")
                .param("s", storyId).param("u", viewer).param("e", value).update();
        notifications.notify(story.authorId(), viewer, "story_reaction", Target.story(storyId, value));
    }

    /** A reply is a direct message referencing the story (PLAN.md §9.9); messaging privacy applies. */
    @Transactional
    public ReplyResult reply(UUID viewer, UUID storyId, String clientId, String text) {
        StoryRow story = require(viewer, storyId);
        if (story.authorId().equals(viewer)) throw ApiException.validation("You can't reply to your own story.");
        UUID conversationId = chat.direct(viewer, story.authorId()).id();
        String key = clientId == null || clientId.isBlank() ? Ids.newId().toString() : clientId;
        var message = chat.send(viewer, conversationId, new SendMessage(key, text, List.of(), null), storyId);
        return new ReplyResult(conversationId, message);
    }

    @Transactional
    public StoryDto create(UUID viewer, UUID mediaId, String text) {
        MediaRow file = media.findOwned(viewer, List.of(mediaId)).stream().findFirst()
                .filter(m -> "image".equals(m.kind()) || "video".equals(m.kind()))
                .orElseThrow(() -> ApiException.validation("Stories accept only your own photos and videos."));
        String overlay = text == null || text.isBlank() ? null : text.strip();
        if (overlay != null && overlay.length() > 250) throw ApiException.validation("The story text is too long.");
        UserRow author = users.require(viewer);
        UUID id = Ids.newId();
        Instant now = clock.instant();
        jdbc.sql("""
                INSERT INTO stories (id, author_id, media_id, overlay_text, overlay_language, created_at, expires_at)
                VALUES (:id, :a, :m, :t, :l, :at, :exp)
                """).param("id", id).param("a", viewer).param("m", file.id()).param("t", overlay)
                .param("l", overlay == null ? null : author.nativeLanguage())
                .param("at", Timestamp.from(now)).param("exp", Timestamp.from(now.plus(LIFETIME)))
                .update();
        return project(viewer, List.of(require(viewer, id))).getFirst();
    }

    @org.springframework.stereotype.Component
    static class StoryTexts implements ContentSource {
        private final StoryService stories;
        private final JdbcClient jdbc;

        StoryTexts(StoryService stories, JdbcClient jdbc) {
            this.stories = stories;
            this.jdbc = jdbc;
        }

        @Override
        public String kind() {
            return "story";
        }

        @Override
        public Optional<OriginalTextDto> originalFor(UUID viewer, UUID id) {
            return stories.overlayFor(viewer, id);
        }

        @Override
        public Optional<OriginalTextDto> original(UUID id) {
            return jdbc.sql("SELECT overlay_text, overlay_language FROM stories WHERE id = :id AND overlay_text IS NOT NULL")
                    .param("id", id).query((rs, row) -> new OriginalTextDto(rs.getString(1), rs.getString(2))).optional();
        }
    }
}
