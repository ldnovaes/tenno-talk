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

@Repository
public class ContentTranslationRepository {

    private final JdbcClient jdbc;

    public ContentTranslationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static ContentTranslationDto map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new ContentTranslationDto(rs.getString("target_language"), rs.getString("text"), rs.getString("status"),
                rs.getInt("version"), rs.getTimestamp("updated_at").toInstant());
    }

    public Optional<ContentTranslationDto> find(String kind, UUID id, String language) {
        return jdbc.sql("SELECT * FROM content_translations WHERE content_kind = :k AND content_id = :id AND target_language = :l")
                .param("k", kind).param("id", id).param("l", language)
                .query(ContentTranslationRepository::map).optional();
    }

    /** content id → translation, for one kind and language. */
    public Map<UUID, ContentTranslationDto> findMany(String kind, Collection<UUID> ids, String language) {
        Map<UUID, ContentTranslationDto> result = new HashMap<>();
        if (ids.isEmpty()) return result;
        jdbc.sql("SELECT * FROM content_translations WHERE content_kind = :k AND content_id IN (:ids) AND target_language = :l")
                .param("k", kind).param("ids", ids).param("l", language)
                .query((rs, row) -> {
                    result.put(rs.getObject("content_id", UUID.class), map(rs, row));
                    return null;
                }).list();
        return result;
    }

    public void saveTranslated(String kind, UUID id, String language, String text, Instant at) {
        jdbc.sql("""
                INSERT INTO content_translations (content_kind, content_id, target_language, text, status, version, updated_at)
                VALUES (:k, :id, :l, :text, 'translated', 1, :at)
                ON CONFLICT (content_kind, content_id, target_language) DO UPDATE SET text = :text, status = 'translated',
                    version = content_translations.version + 1, updated_at = :at
                """)
                .param("k", kind).param("id", id).param("l", language).param("text", text).param("at", Timestamp.from(at))
                .update();
    }

    public void saveStatus(String kind, UUID id, String language, String status, Instant at) {
        jdbc.sql("""
                INSERT INTO content_translations (content_kind, content_id, target_language, status, updated_at)
                VALUES (:k, :id, :l, :s, :at)
                ON CONFLICT (content_kind, content_id, target_language) DO UPDATE SET status = :s, updated_at = :at
                WHERE content_translations.status <> 'translated'
                """)
                .param("k", kind).param("id", id).param("l", language).param("s", status).param("at", Timestamp.from(at))
                .update();
    }
}
