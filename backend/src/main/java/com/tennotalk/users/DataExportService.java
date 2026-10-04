package com.tennotalk.users;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * LGPD right of access (PLAN.md §31): everything stored about the person, as JSON.
 * Postgres builds each section (json_agg), so arrays and timestamps keep their exact form.
 * Never includes the password hash or other people's private data.
 */
@Service
public class DataExportService {

    /** Section name → query over :me; each returns rows as objects. Order is the file's order. */
    private static final Map<String, String> SECTIONS = new LinkedHashMap<>();

    static {
        SECTIONS.put("account", """
                SELECT id, email, username, display_name, bio, country, native_language, learning_languages, avatar_url,
                       role, onboarding_completed_at, last_seen_at, created_at
                FROM users WHERE id = :me""");
        SECTIONS.put("linkedAccounts", "SELECT provider, email, created_at FROM oauth_accounts WHERE user_id = :me");
        SECTIONS.put("termsAcceptances", "SELECT terms_version, accepted_at, ip, user_agent FROM terms_acceptances WHERE user_id = :me ORDER BY accepted_at");
        SECTIONS.put("preferences", "SELECT * FROM user_preferences WHERE user_id = :me");
        SECTIONS.put("following", """
                SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = :me""");
        SECTIONS.put("followers", """
                SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = :me""");
        SECTIONS.put("followRequestsSent", """
                SELECT u.username, r.created_at FROM follow_requests r JOIN users u ON u.id = r.followee_id WHERE r.follower_id = :me""");
        SECTIONS.put("followRequestsReceived", """
                SELECT u.username, r.created_at FROM follow_requests r JOIN users u ON u.id = r.follower_id WHERE r.followee_id = :me""");
        SECTIONS.put("blocked", """
                SELECT u.username, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = :me""");
        SECTIONS.put("conversations", """
                SELECT c.id, c.kind, c.title, c.created_at,
                       (SELECT json_agg(u.username) FROM conversation_members o JOIN users u ON u.id = o.user_id
                        WHERE o.conversation_id = c.id) AS members
                FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = :me""");
        SECTIONS.put("messagesSent", """
                SELECT id, conversation_id, type, original_text, original_language, reply_to_id, story_id, created_at
                FROM messages WHERE sender_id = :me ORDER BY created_at""");
        SECTIONS.put("posts", "SELECT id, caption_text, caption_language, created_at FROM posts WHERE author_id = :me ORDER BY created_at");
        SECTIONS.put("comments", "SELECT id, post_id, body_text, body_language, created_at FROM comments WHERE author_id = :me ORDER BY created_at");
        SECTIONS.put("likes", "SELECT post_id, created_at FROM likes WHERE user_id = :me");
        SECTIONS.put("stories", "SELECT id, media_id, overlay_text, overlay_language, created_at, expires_at FROM stories WHERE author_id = :me");
        SECTIONS.put("media", "SELECT id, kind, mime_type, size_bytes, original_name, created_at FROM media WHERE owner_id = :me");
        SECTIONS.put("notifications", "SELECT type, created_at, read_at FROM notifications WHERE recipient_id = :me ORDER BY created_at");
        SECTIONS.put("reportsFiled", "SELECT target_kind, target_id, reason, status, created_at FROM reports WHERE reporter_id = :me");
    }

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public DataExportService(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public ObjectNode export(UUID me) {
        ObjectNode root = json.createObjectNode();
        root.put("format", "tenno-talk-export/1");
        SECTIONS.forEach((name, sql) -> {
            String rows = jdbc.sql("SELECT coalesce(json_agg(t), '[]'::json)::text FROM (" + sql + ") t")
                    .param("me", me).query(String.class).single();
            JsonNode parsed = json.readTree(rows);
            boolean single = name.equals("account") || name.equals("preferences");
            root.set(name, single ? (parsed.isEmpty() ? json.nullNode() : parsed.get(0)) : parsed);
        });
        return root;
    }
}
