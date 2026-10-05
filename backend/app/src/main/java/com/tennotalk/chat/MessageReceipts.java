package com.tennotalk.chat;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class MessageReceipts {
    private final JdbcClient jdbc;
    public MessageReceipts(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void snapshot(MessageRow message) {
        jdbc.sql("""
            INSERT INTO message_receipts(message_id, recipient_id)
            SELECT :m, user_id FROM conversation_members WHERE conversation_id = :c AND user_id <> :sender
            ON CONFLICT DO NOTHING
            """).param("m", message.id()).param("c", message.conversationId()).param("sender", message.senderId()).update();
    }

    public boolean delivered(UUID viewer, UUID message) {
        return jdbc.sql("UPDATE message_receipts SET delivered_at = now() WHERE message_id = :m AND recipient_id = :u AND delivered_at IS NULL")
            .param("m", message).param("u", viewer).update() > 0;
    }

    public List<UUID> read(UUID viewer, UUID conversation, UUID cursor) {
        return jdbc.sql("""
            UPDATE message_receipts r SET read_at = now(), delivered_at = COALESCE(r.delivered_at, now())
            FROM messages m, messages boundary
            WHERE r.message_id = m.id AND r.recipient_id = :u AND r.read_at IS NULL
            AND m.conversation_id = :c AND boundary.id = :cursor
            AND (m.created_at, m.id) <= (boundary.created_at, boundary.id)
            RETURNING r.message_id
            """).param("u", viewer).param("c", conversation).param("cursor", cursor).query(UUID.class).list();
    }

    public Map<UUID, String> statuses(List<MessageRow> messages) {
        Map<UUID, String> result = new HashMap<>();
        if (messages.isEmpty()) return result;
        jdbc.sql("""
            SELECT message_id, CASE WHEN bool_and(read_at IS NOT NULL) THEN 'read'
            WHEN bool_and(delivered_at IS NOT NULL) THEN 'delivered' ELSE 'sent' END AS status
            FROM message_receipts WHERE message_id IN (:ids) GROUP BY message_id
            """).param("ids", messages.stream().map(MessageRow::id).toList()).query((rs, row) -> {
                result.put(rs.getObject("message_id", UUID.class), rs.getString("status")); return true;
            }).list();
        return result;
    }
}
