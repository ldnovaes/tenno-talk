package com.tennotalk.users;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PreferencesRepository {

    private final JdbcClient jdbc;

    public PreferencesRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Preferences find(UUID userId) {
        return jdbc.sql("SELECT * FROM user_preferences WHERE user_id = :id")
                .param("id", userId)
                .query((rs, row) -> new Preferences(
                        rs.getString("interface_language"),
                        new Preferences.Translation(
                                rs.getString("receiving_language"),
                                rs.getString("display_mode"),
                                rs.getBoolean("auto_translate_posts"),
                                rs.getBoolean("auto_translate_stories"),
                                rs.getBoolean("learning_mode")),
                        new Preferences.Privacy(
                                rs.getString("profile_visibility"),
                                rs.getString("who_can_message"),
                                rs.getString("who_can_comment")),
                        new Preferences.Notifications(
                                rs.getBoolean("notify_messages"),
                                rs.getBoolean("notify_comments"),
                                rs.getBoolean("notify_likes"),
                                rs.getBoolean("notify_followers"))))
                .single();
    }

    /**
     * A new receiving language applies from {@code since} on (PLAN.md §21). Without history yet,
     * the previous language is recorded first, from the creation of the account.
     */
    public void recordReceivingChange(UUID userId, String previous, String language, Instant since) {
        jdbc.sql("""
                INSERT INTO receiving_language_history (user_id, language, since)
                SELECT u.id, :previous, LEAST(u.created_at, :since) FROM users u
                WHERE u.id = :id AND NOT EXISTS (SELECT 1 FROM receiving_language_history h WHERE h.user_id = u.id)
                """)
                .param("id", userId)
                .param("previous", previous)
                .param("since", Timestamp.from(since))
                .update();
        jdbc.sql("""
                INSERT INTO receiving_language_history (user_id, language, since) VALUES (:id, :language, :since)
                ON CONFLICT (user_id, since) DO UPDATE SET language = EXCLUDED.language
                """)
                .param("id", userId)
                .param("language", language)
                .param("since", Timestamp.from(since))
                .update();
    }

    public void save(UUID userId, Preferences p) {
        jdbc.sql("""
                UPDATE user_preferences SET interface_language = :interfaceLanguage,
                    receiving_language = :receiving, display_mode = :mode,
                    auto_translate_posts = :autoPosts, auto_translate_stories = :autoStories, learning_mode = :learning,
                    profile_visibility = :visibility, who_can_message = :message, who_can_comment = :comment,
                    notify_messages = :nMessages, notify_comments = :nComments, notify_likes = :nLikes,
                    notify_followers = :nFollowers
                WHERE user_id = :id
                """)
                .param("interfaceLanguage", p.interfaceLanguage())
                .param("receiving", p.translation().receivingLanguage())
                .param("mode", p.translation().displayMode())
                .param("autoPosts", p.translation().autoTranslatePosts())
                .param("autoStories", p.translation().autoTranslateStories())
                .param("learning", p.translation().learningMode())
                .param("visibility", p.privacy().profileVisibility())
                .param("message", p.privacy().whoCanMessage())
                .param("comment", p.privacy().whoCanComment())
                .param("nMessages", p.notifications().messages())
                .param("nComments", p.notifications().comments())
                .param("nLikes", p.notifications().likes())
                .param("nFollowers", p.notifications().followers())
                .param("id", userId)
                .update();
    }

    public String receivingLanguage(UUID userId) {
        return jdbc.sql("SELECT receiving_language FROM user_preferences WHERE user_id = :id")
                .param("id", userId)
                .query(String.class)
                .single();
    }

    /** A shared row lock makes a completed privacy change authoritative for later sends. */
    public String whoCanMessageForShare(UUID userId) {
        return jdbc.sql("SELECT who_can_message FROM user_preferences WHERE user_id = :id FOR SHARE")
                .param("id", userId).query(String.class).single();
    }

    public String profileVisibilityForShare(UUID userId) {
        return jdbc.sql("SELECT profile_visibility FROM user_preferences WHERE user_id = :id FOR SHARE")
                .param("id", userId).query(String.class).single();
    }
}
