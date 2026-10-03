package com.tennotalk.notifications;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.tennotalk.common.Ids;
import com.tennotalk.realtime.RealtimeHub;
import com.tennotalk.users.UserDtos.UserDto;

@Service
public class NotificationService {

    public record Created(UUID notificationId, UUID recipientId) {}

    /** What a notification points to (only the fields of its type are set). */
    public record Target(UUID postId, UUID commentId, UUID storyId, String emoji, UUID conversationId, UUID messageId) {
        public static Target none() {
            return new Target(null, null, null, null, null, null);
        }

        public static Target post(UUID postId) {
            return new Target(postId, null, null, null, null, null);
        }

        public static Target comment(UUID postId, UUID commentId) {
            return new Target(postId, commentId, null, null, null, null);
        }

        public static Target story(UUID storyId, String emoji) {
            return new Target(null, null, storyId, emoji, null, null);
        }
    }

    private static final Map<String, String> PREFERENCE = Map.of(
            "like", "notify_likes", "comment", "notify_comments", "follow", "notify_followers",
            "story_reaction", "notify_likes", "new_message", "notify_messages");

    private final JdbcClient jdbc;
    private final ApplicationEventPublisher events;
    private final RealtimeHub hub;
    private final Clock clock;

    public NotificationService(JdbcClient jdbc, ApplicationEventPublisher events, RealtimeHub hub, Clock clock) {
        this.jdbc = jdbc;
        this.events = events;
        this.hub = hub;
        this.clock = clock;
    }

    /** Creates a notification unless it is to yourself or the recipient turned that type off. */
    @Transactional
    public void notify(UUID recipient, UUID actor, String type, Target target) {
        if (recipient.equals(actor)) return;
        boolean wanted = jdbc.sql("SELECT " + PREFERENCE.get(type) + " FROM user_preferences WHERE user_id = :u")
                .param("u", recipient).query(Boolean.class).optional().orElse(false);
        if (!wanted) return;
        UUID id = Ids.newId();
        jdbc.sql("""
                INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, comment_id, story_id, emoji, conversation_id, message_id, created_at)
                VALUES (:id, :r, :a, :t, :post, :comment, :story, :emoji, :conversation, :message, :at)
                """)
                .param("id", id).param("r", recipient).param("a", actor).param("t", type)
                .param("post", target.postId()).param("comment", target.commentId()).param("story", target.storyId())
                .param("emoji", target.emoji()).param("conversation", target.conversationId()).param("message", target.messageId())
                .param("at", Timestamp.from(clock.instant()))
                .update();
        events.publishEvent(new Created(id, recipient));
    }

    private static final String SELECT = """
            SELECT n.*, u.username, u.display_name, u.avatar_url FROM notifications n
            JOIN users u ON u.id = n.actor_id
            WHERE n.recipient_id = :me
              AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = :me AND b.blocked_id = n.actor_id)
            """;

    private static NotificationDto map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        Timestamp read = rs.getTimestamp("read_at");
        String username = rs.getString("username");
        return new NotificationDto(
                rs.getObject("id", UUID.class),
                rs.getString("type"),
                new UserDto(rs.getObject("actor_id", UUID.class), username == null ? "" : username, rs.getString("display_name"), rs.getString("avatar_url")),
                rs.getTimestamp("created_at").toInstant(),
                read == null ? null : read.toInstant(),
                rs.getObject("post_id", UUID.class),
                rs.getObject("comment_id", UUID.class),
                rs.getObject("story_id", UUID.class),
                rs.getString("emoji"),
                rs.getObject("conversation_id", UUID.class),
                rs.getObject("message_id", UUID.class));
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(UUID me) {
        return jdbc.sql(SELECT + " ORDER BY n.created_at DESC LIMIT 100").param("me", me).query(NotificationService::map).list();
    }

    @Transactional(readOnly = true)
    public long unread(UUID me) {
        return jdbc.sql("SELECT count(*) FROM (" + SELECT + " AND n.read_at IS NULL) x").param("me", me).query(Long.class).single();
    }

    @Transactional
    public void markAllRead(UUID me) {
        jdbc.sql("UPDATE notifications SET read_at = :at WHERE recipient_id = :me AND read_at IS NULL")
                .param("at", Timestamp.from(clock.instant())).param("me", me).update();
    }

    /** Live badge update (frontend "notification.created"). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void push(Created created) {
        jdbc.sql(SELECT + " AND n.id = :id").param("me", created.recipientId()).param("id", created.notificationId())
                .query(NotificationService::map).optional()
                .ifPresent(dto -> hub.send(created.recipientId(), "notification.created", Map.of("notification", dto)));
    }
}
