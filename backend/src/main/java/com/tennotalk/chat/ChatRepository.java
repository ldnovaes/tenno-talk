package com.tennotalk.chat;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.tennotalk.common.Cursor;
import com.tennotalk.users.UserDtos.UserDto;

@Repository
public class ChatRepository {

    private final JdbcClient jdbc;

    public ChatRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    static MessageRow message(ResultSet rs, int row) throws SQLException {
        return new MessageRow(
                rs.getObject("id", UUID.class),
                rs.getObject("conversation_id", UUID.class),
                rs.getObject("sender_id", UUID.class),
                rs.getString("client_id"),
                rs.getString("type"),
                rs.getString("original_text"),
                rs.getString("original_language"),
                rs.getObject("reply_to_id", UUID.class),
                rs.getObject("story_id", UUID.class),
                instant(rs, "created_at"));
    }

    static ConversationRow conversation(ResultSet rs, int row) throws SQLException {
        return new ConversationRow(
                rs.getObject("id", UUID.class),
                rs.getString("kind"),
                rs.getString("title"),
                rs.getString("avatar_url"),
                rs.getObject("created_by", UUID.class),
                instant(rs, "created_at"),
                instant(rs, "updated_at"));
    }

    // ---- conversations ---------------------------------------------------

    public Optional<ConversationRow> findConversation(UUID id) {
        return jdbc.sql("SELECT * FROM conversations WHERE id = :id").param("id", id).query(ChatRepository::conversation).optional();
    }

    public boolean isMember(UUID conversationId, UUID userId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = :c AND user_id = :u)")
                .param("c", conversationId)
                .param("u", userId)
                .query(Boolean.class)
                .single();
    }

    public List<ConversationRow> conversationsOf(UUID userId) {
        return jdbc.sql("""
                SELECT c.* FROM conversations c
                JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = :u
                ORDER BY c.updated_at DESC, c.id
                """).param("u", userId).query(ChatRepository::conversation).list();
    }

    public Optional<UUID> findDirect(String directKey) {
        return jdbc.sql("SELECT id FROM conversations WHERE direct_key = :k").param("k", directKey).query(UUID.class).optional();
    }

    public void insertConversation(UUID id, String kind, String title, UUID createdBy, String directKey) {
        jdbc.sql("INSERT INTO conversations (id, kind, title, created_by, direct_key) VALUES (:id, :kind, :title, :by, :key)")
                .param("id", id)
                .param("kind", kind)
                .param("title", title)
                .param("by", createdBy)
                .param("key", directKey)
                .update();
    }

    public void addMember(UUID conversationId, UUID userId, String role) {
        jdbc.sql("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (:c, :u, :r)")
                .param("c", conversationId)
                .param("u", userId)
                .param("r", role)
                .update();
    }

    public void touch(UUID conversationId, Instant at) {
        jdbc.sql("UPDATE conversations SET updated_at = GREATEST(updated_at, :at) WHERE id = :id")
                .param("at", Timestamp.from(at))
                .param("id", conversationId)
                .update();
    }

    /** Members of several conversations, cursors resolved to timestamps. */
    public Map<UUID, List<MemberRow>> members(Collection<UUID> conversationIds) {
        Map<UUID, List<MemberRow>> result = new HashMap<>();
        if (conversationIds.isEmpty()) return result;
        jdbc.sql("""
                SELECT m.conversation_id, m.role, m.last_read_message_id, m.muted_until,
                       u.id AS user_id, u.username, u.display_name, u.avatar_url, u.last_seen_at,
                       p.receiving_language,
                       r.created_at AS last_read_at, d.created_at AS last_delivered_at
                FROM conversation_members m
                JOIN users u ON u.id = m.user_id
                JOIN user_preferences p ON p.user_id = u.id
                LEFT JOIN messages r ON r.id = m.last_read_message_id
                LEFT JOIN messages d ON d.id = m.last_delivered_message_id
                WHERE m.conversation_id IN (:ids)
                ORDER BY m.joined_at, u.id
                """).param("ids", conversationIds).query((rs, row) -> {
            UUID conversationId = rs.getObject("conversation_id", UUID.class);
            String username = rs.getString("username");
            result.computeIfAbsent(conversationId, key -> new ArrayList<>()).add(new MemberRow(
                    conversationId,
                    new UserDto(rs.getObject("user_id", UUID.class), username == null ? "" : username,
                            rs.getString("display_name"), rs.getString("avatar_url")),
                    rs.getString("role"),
                    rs.getString("receiving_language"),
                    rs.getObject("last_read_message_id", UUID.class),
                    instant(rs, "last_read_at"),
                    instant(rs, "last_delivered_at"),
                    instant(rs, "muted_until"),
                    instant(rs, "last_seen_at")));
            return null;
        }).list();
        return result;
    }

    public List<MemberRow> members(UUID conversationId) {
        return members(List.of(conversationId)).getOrDefault(conversationId, List.of());
    }

    /** Moves a cursor forward only (reading also counts as delivered). Returns true when it changed. */
    public boolean advanceCursor(UUID conversationId, UUID userId, UUID messageId, boolean read) {
        String column = read ? "last_read_message_id" : "last_delivered_message_id";
        String alsoDelivered = read ? """
                , last_delivered_message_id = CASE
                    WHEN EXISTS (SELECT 1 FROM messages d WHERE d.id = cm.last_delivered_message_id
                                 AND d.created_at >= (SELECT created_at FROM messages WHERE id = :m))
                    THEN cm.last_delivered_message_id ELSE :m END
                """ : "";
        return jdbc.sql("""
                UPDATE conversation_members cm SET %s = :m %s
                WHERE cm.conversation_id = :c AND cm.user_id = :u
                  AND EXISTS (SELECT 1 FROM messages nm WHERE nm.id = :m AND nm.conversation_id = :c
                              AND NOT EXISTS (SELECT 1 FROM messages cur WHERE cur.id = cm.%s AND cur.created_at >= nm.created_at))
                """.formatted(column, alsoDelivered, column))
                .param("c", conversationId)
                .param("u", userId)
                .param("m", messageId)
                .update() > 0;
    }

    public void setMuted(UUID conversationId, UUID userId, Instant until) {
        jdbc.sql("UPDATE conversation_members SET muted_until = :until WHERE conversation_id = :c AND user_id = :u")
                .param("until", until == null ? null : Timestamp.from(until))
                .param("c", conversationId)
                .param("u", userId)
                .update();
    }

    public int unreadCount(UUID conversationId, UUID userId, Instant lastReadAt) {
        return jdbc.sql("""
                SELECT count(*) FROM messages WHERE conversation_id = :c AND sender_id <> :u
                AND (CAST(:after AS timestamptz) IS NULL OR created_at > :after)
                """)
                .param("c", conversationId)
                .param("u", userId)
                .param("after", lastReadAt == null ? null : Timestamp.from(lastReadAt))
                .query(Integer.class)
                .single();
    }

    // ---- messages --------------------------------------------------------

    public Optional<MessageRow> findMessage(UUID id) {
        return jdbc.sql("SELECT * FROM messages WHERE id = :id").param("id", id).query(ChatRepository::message).optional();
    }

    public Map<UUID, MessageRow> findMessages(Collection<UUID> ids) {
        Map<UUID, MessageRow> result = new HashMap<>();
        if (ids.isEmpty()) return result;
        jdbc.sql("SELECT * FROM messages WHERE id IN (:ids)").param("ids", ids).query(ChatRepository::message).list()
                .forEach(message -> result.put(message.id(), message));
        return result;
    }

    public Optional<MessageRow> findByClientId(UUID senderId, String clientId) {
        return jdbc.sql("SELECT * FROM messages WHERE sender_id = :s AND client_id = :c")
                .param("s", senderId)
                .param("c", clientId)
                .query(ChatRepository::message)
                .optional();
    }

    public MessageRow insertMessage(UUID id, UUID conversationId, UUID senderId, String clientId, String type,
            String text, String language, UUID replyToId, UUID storyId) {
        return jdbc.sql("""
                INSERT INTO messages (id, conversation_id, sender_id, client_id, type, original_text, original_language, reply_to_id, story_id)
                VALUES (:id, :c, :s, :client, :type, :text, :lang, :reply, :story)
                RETURNING *
                """)
                .param("id", id)
                .param("c", conversationId)
                .param("s", senderId)
                .param("client", clientId)
                .param("type", type)
                .param("text", text)
                .param("lang", language)
                .param("reply", replyToId)
                .param("story", storyId)
                .query(ChatRepository::message)
                .single();
    }

    public void attachMedia(UUID messageId, List<UUID> mediaIds) {
        for (int position = 0; position < mediaIds.size(); position++) {
            jdbc.sql("INSERT INTO message_media (message_id, media_id, position) VALUES (:m, :media, :p)")
                    .param("m", messageId)
                    .param("media", mediaIds.get(position))
                    .param("p", position)
                    .update();
        }
    }

    /** Newest first, older than the cursor. */
    public List<MessageRow> pageBefore(UUID conversationId, Cursor cursor, int limit) {
        return jdbc.sql("""
                SELECT * FROM messages WHERE conversation_id = :c
                AND (CAST(:at AS timestamptz) IS NULL OR (created_at, id) < (:at, :id))
                ORDER BY created_at DESC, id DESC LIMIT :limit
                """)
                .param("c", conversationId)
                .param("at", cursor == null ? null : Timestamp.from(cursor.createdAt()))
                .param("id", cursor == null ? null : cursor.id())
                .param("limit", limit)
                .query(ChatRepository::message)
                .list();
    }

    public Optional<MessageRow> lastMessage(UUID conversationId) {
        return pageBefore(conversationId, null, 1).stream().findFirst();
    }

    /** Context for the AI: messages right before a message, oldest first. */
    public List<MessageRow> before(UUID conversationId, Instant at, UUID messageId, int limit) {
        List<MessageRow> rows = pageBefore(conversationId, new Cursor(at, messageId), limit);
        List<MessageRow> ordered = new ArrayList<>(rows);
        java.util.Collections.reverse(ordered);
        return ordered;
    }

    public Optional<MessageRow> lastFromOthers(UUID conversationId, UUID userId) {
        return jdbc.sql("""
                SELECT * FROM messages WHERE conversation_id = :c AND sender_id <> :u ORDER BY created_at DESC, id DESC LIMIT 1
                """).param("c", conversationId).param("u", userId).query(ChatRepository::message).optional();
    }

    // ---- reactions -------------------------------------------------------

    public record ReactionRow(UUID messageId, UUID userId, String emoji) {}

    public Map<UUID, List<ReactionRow>> reactions(Collection<UUID> messageIds) {
        Map<UUID, List<ReactionRow>> result = new HashMap<>();
        if (messageIds.isEmpty()) return result;
        jdbc.sql("SELECT * FROM message_reactions WHERE message_id IN (:ids) ORDER BY created_at")
                .param("ids", messageIds)
                .query((rs, row) -> new ReactionRow(rs.getObject("message_id", UUID.class), rs.getObject("user_id", UUID.class), rs.getString("emoji")))
                .list()
                .forEach(reaction -> result.computeIfAbsent(reaction.messageId(), key -> new ArrayList<>()).add(reaction));
        return result;
    }

    /** Toggles a reaction; returns true when it was added. */
    public boolean toggleReaction(UUID messageId, UUID userId, String emoji) {
        int removed = jdbc.sql("DELETE FROM message_reactions WHERE message_id = :m AND user_id = :u AND emoji = :e")
                .param("m", messageId).param("u", userId).param("e", emoji).update();
        if (removed > 0) return false;
        jdbc.sql("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (:m, :u, :e)")
                .param("m", messageId).param("u", userId).param("e", emoji).update();
        return true;
    }
}
