package com.tennotalk.translation;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;

/** message_translations: one row per (message, target language), versioned. */
@Repository
public class MessageTranslationRepository {

    public record Row(UUID messageId, String targetLanguage, String text, String literal, String status, int version,
            String provider, Instant updatedAt) {

        public ContentTranslationDto toDto() {
            return new ContentTranslationDto(targetLanguage, text, status, version, updatedAt);
        }
    }

    private final JdbcClient jdbc;

    public MessageTranslationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static Row map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Row(
                rs.getObject("message_id", UUID.class),
                rs.getString("target_language"),
                rs.getString("text"),
                rs.getString("literal_text"),
                rs.getString("status"),
                rs.getInt("version"),
                rs.getString("provider"),
                rs.getTimestamp("updated_at").toInstant());
    }

    /** (messageId, language) → row. */
    public Map<String, Row> forMessages(Collection<UUID> messageIds) {
        Map<String, Row> result = new HashMap<>();
        if (messageIds.isEmpty()) return result;
        jdbc.sql("SELECT * FROM message_translations WHERE message_id IN (:ids)")
                .param("ids", messageIds)
                .query(MessageTranslationRepository::map)
                .list()
                .forEach(row -> result.put(key(row.messageId(), row.targetLanguage()), row));
        return result;
    }

    public static String key(UUID messageId, String language) {
        return messageId + "|" + language;
    }

    public Optional<Row> find(UUID messageId, String language) {
        return jdbc.sql("SELECT * FROM message_translations WHERE message_id = :m AND target_language = :l")
                .param("m", messageId)
                .param("l", language)
                .query(MessageTranslationRepository::map)
                .optional();
    }

    /** Creates the pending row; returns false if it already existed. */
    public boolean insertPending(UUID messageId, String language) {
        return jdbc.sql("""
                INSERT INTO message_translations (message_id, target_language, status) VALUES (:m, :l, 'pending')
                ON CONFLICT DO NOTHING
                """).param("m", messageId).param("l", language).update() > 0;
    }

    public void setStatus(UUID messageId, String language, String status, String error, Instant at) {
        jdbc.sql("""
                UPDATE message_translations SET status = :s, error = :e, updated_at = :at
                WHERE message_id = :m AND target_language = :l AND status <> 'translated'
                """)
                .param("s", status)
                .param("e", error)
                .param("at", Timestamp.from(at))
                .param("m", messageId)
                .param("l", language)
                .update();
    }

    /** Saves a translation as a new version (a better one replaces the old, PLAN.md §14.2). */
    public void saveTranslated(UUID messageId, String language, String text, String literal, String provider, Instant at) {
        jdbc.sql("""
                INSERT INTO message_translations (message_id, target_language, text, literal_text, status, version, provider, updated_at)
                VALUES (:m, :l, :text, :literal, 'translated', 1, :p, :at)
                ON CONFLICT (message_id, target_language) DO UPDATE SET text = :text, literal_text = :literal,
                    status = 'translated', version = message_translations.version + 1, provider = :p, error = NULL, updated_at = :at
                """)
                .param("m", messageId)
                .param("l", language)
                .param("text", text)
                .param("literal", literal)
                .param("p", provider)
                .param("at", Timestamp.from(at))
                .update();
    }

    /** Back to pending for a retry, keeping the current text and version. */
    public void resetForRetry(UUID messageId, String language, Instant at) {
        jdbc.sql("""
                INSERT INTO message_translations (message_id, target_language, status, updated_at) VALUES (:m, :l, 'pending', :at)
                ON CONFLICT (message_id, target_language) DO UPDATE SET status = 'pending', error = NULL, updated_at = :at
                """)
                .param("m", messageId)
                .param("l", language)
                .param("at", Timestamp.from(at))
                .update();
    }
}
