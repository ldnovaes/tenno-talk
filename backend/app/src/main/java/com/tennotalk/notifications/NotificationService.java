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

    public record Read(UUID recipientId) {}

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
            "follow_request", "notify_followers", "follow_accepted", "notify_followers",
            "story_reaction", "notify_likes", "new_message", "notify_messages");

    /** Toggling a like or a follow never notifies (and pushes) again within a day (PLAN.md §38). */
    private static final java.util.Set<String> ONCE_A_DAY = java.util.Set.of("like", "follow");

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
        if (jdbc.sql("SELECT EXISTS(SELECT 1 FROM blocks WHERE (blocker_id = :r AND blocked_id = :a) OR (blocker_id = :a AND blocked_id = :r))")
            .param("r", recipient).param("a", actor).query(Boolean.class).single()) return;
        if (ONCE_A_DAY.contains(type) && jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM notifications WHERE recipient_id = :r AND actor_id = :a AND type = :t
                              AND post_id IS NOT DISTINCT FROM :post AND created_at > :since)
                """)
                .param("r", recipient).param("a", actor).param("t", type).param("post", target.postId())
                .param("since", Timestamp.from(clock.instant().minus(java.time.Duration.ofDays(1))))
                .query(Boolean.class).single()) return;
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

    /** Removes a notification that no longer applies (e.g. a follow request already decided). */
    @Transactional
    public void retract(UUID recipient, UUID actor, String type) {
        int removed = jdbc.sql("DELETE FROM notifications WHERE recipient_id = :r AND actor_id = :a AND type = :t")
                .param("r", recipient).param("a", actor).param("t", type).update();
        if (removed > 0) events.publishEvent(new Read(recipient));
    }

    /** {@link #retract} for every pending notification of a type sent to the recipient. */
    @Transactional
    public void retractAll(UUID recipient, String type) {
        int removed = jdbc.sql("DELETE FROM notifications WHERE recipient_id = :r AND type = :t")
                .param("r", recipient).param("t", type).update();
        if (removed > 0) events.publishEvent(new Read(recipient));
    }

    private static final String SELECT = """
            SELECT n.*, u.username, u.display_name, u.avatar_url FROM notifications n
            JOIN users u ON u.id = n.actor_id
            WHERE n.recipient_id = :me
              AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = :me AND b.blocked_id = n.actor_id) OR (b.blocker_id = n.actor_id AND b.blocked_id = :me))
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
    public List<NotificationDto> list(UUID me) { return list(me, null); }

    public List<NotificationDto> list(UUID me, UUID beforeId) {
        String before = beforeId == null ? "" : " AND (n.created_at, n.id) < (SELECT created_at, id FROM notifications WHERE id = :before AND recipient_id = :me)";
        var query = jdbc.sql(SELECT + before + " ORDER BY n.created_at DESC, n.id DESC LIMIT 100").param("me", me);
        if (beforeId != null) query.param("before", beforeId);
        return query.query(NotificationService::map).list();
    }

    @Transactional(readOnly = true)
    public long unread(UUID me) {
        return jdbc.sql("SELECT count(*) FROM (" + SELECT + " AND n.read_at IS NULL) x").param("me", me).query(Long.class).single();
    }

    @Transactional
    public void markAllRead(UUID me) {
        jdbc.sql("UPDATE notifications SET read_at = :at WHERE recipient_id = :me AND read_at IS NULL AND created_at <= :at")
                .param("at", Timestamp.from(clock.instant())).param("me", me).update();
        events.publishEvent(new Read(me));
    }

    @Transactional
    public void markRead(UUID me, List<UUID> ids) {
        if (ids.isEmpty()) return;
        jdbc.sql("UPDATE notifications SET read_at = :at WHERE recipient_id = :me AND id IN (:ids) AND read_at IS NULL")
            .param("at", Timestamp.from(clock.instant())).param("me", me).param("ids", ids).update();
        events.publishEvent(new Read(me));
    }

    @Transactional
    public void readConversation(UUID me, UUID conversation, UUID cursor) {
        jdbc.sql("""
            UPDATE notifications n SET read_at = :at FROM messages m, messages boundary
            WHERE n.recipient_id = :me AND n.conversation_id = :c AND n.message_id = m.id
            AND boundary.id = :cursor AND (m.created_at, m.id) <= (boundary.created_at, boundary.id) AND n.read_at IS NULL
            """).param("at", Timestamp.from(clock.instant())).param("me", me).param("c", conversation).param("cursor", cursor).update();
        events.publishEvent(new Read(me));
    }

    public void pushRead(Read event) { hub.send(event.recipientId(), "notifications.read", Map.of()); }

    /** Live badge update (frontend "notification.created"). */
    public void push(Created created) {
        jdbc.sql(SELECT + " AND n.id = :id").param("me", created.recipientId()).param("id", created.notificationId())
                .query(NotificationService::map).optional()
                .ifPresent(dto -> hub.send(created.recipientId(), "notification.created", Map.of("notification", dto)));
    }
}
