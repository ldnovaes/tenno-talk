package com.tennotalk.support;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.tennotalk.auth.AppPrincipal;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

/** Builds database state directly (fast) and authenticates MockMvc requests. */
@Component
public class TestData {

    public static final String TERMS = "2026-10-04";

    private final JdbcClient jdbc;
    private final com.tennotalk.auth.LoginThrottle loginThrottle;

    public TestData(JdbcClient jdbc, com.tennotalk.auth.LoginThrottle loginThrottle) {
        this.jdbc = jdbc;
        this.loginThrottle = loginThrottle;
    }

    /**
     * Empties the database between tests. A background worker (realtime jobs left by the previous test) may hold a
     * lock the TRUNCATE needs and wait for one it holds: PostgreSQL then cancels one side, and trying again wins.
     */
    public void reset() {
        loginThrottle.reset();
        for (int attempt = 1; ; attempt++) {
            try {
                truncate();
                return;
            } catch (org.springframework.dao.PessimisticLockingFailureException deadlock) {
                if (attempt == 5) throw deadlock;
            }
        }
    }

    private void truncate() {
        jdbc.sql("""
                TRUNCATE realtime_jobs, users, oauth_accounts, terms_acceptances, user_preferences, follows, blocks, conversations,
                         conversation_members, media, messages, message_media, message_reactions, message_translations,
                         translation_jobs, posts, post_media, likes, comments, stories, story_views, story_reactions,
                         content_translations, notifications, reports, SPRING_SESSION, SPRING_SESSION_ATTRIBUTES CASCADE
                """).update();
        jdbc.sql("UPDATE ai_provider_status SET state = 'ok', until = NULL, last_error = NULL").update();
    }

    /** An onboarded user who accepted the current terms. */
    public UUID user(String username, String nativeLanguage) {
        return user(username, nativeLanguage, nativeLanguage);
    }

    public UUID user(String username, String nativeLanguage, String receivingLanguage) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO users (id, email, username, display_name, country, native_language, onboarding_completed_at)
                VALUES (:id, :email, :username, :name, 'BR', :language, now())
                """)
                .param("id", id)
                .param("email", username + "@example.com")
                .param("username", username)
                .param("name", Character.toUpperCase(username.charAt(0)) + username.substring(1))
                .param("language", nativeLanguage)
                .update();
        jdbc.sql("INSERT INTO user_preferences (user_id, receiving_language) VALUES (:id, :language)")
                .param("id", id)
                .param("language", receivingLanguage)
                .update();
        jdbc.sql("INSERT INTO terms_acceptances (user_id, terms_version) VALUES (:id, :v)").param("id", id).param("v", TERMS).update();
        return id;
    }

    /** Signed up and accepted the terms, but has not finished onboarding (no username yet). */
    public UUID newcomer(String emailName) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO users (id, email, native_language) VALUES (:id, :email, 'en-US')")
                .param("id", id).param("email", emailName + "@example.com").update();
        jdbc.sql("INSERT INTO user_preferences (user_id, receiving_language) VALUES (:id, 'en-US')").param("id", id).update();
        jdbc.sql("INSERT INTO terms_acceptances (user_id, terms_version) VALUES (:id, :v)").param("id", id).param("v", TERMS).update();
        return id;
    }

    /** A media row owned by {@code owner} (no file on disk; enough for posts, stories and messages). */
    public UUID media(UUID owner, String kind) {
        UUID id = UUID.randomUUID();
        String mime = switch (kind) {
            case "image" -> "image/png";
            case "video" -> "video/mp4";
            case "audio" -> "audio/mpeg";
            default -> "application/pdf";
        };
        jdbc.sql("""
                INSERT INTO media (id, owner_id, kind, mime_type, size_bytes, storage_path, original_name)
                VALUES (:id, :owner, :kind, :mime, 10, :path, 'file')
                """).param("id", id).param("owner", owner).param("kind", kind).param("mime", mime)
                .param("path", "test/" + id).update();
        return id;
    }

    public void password(UUID user, String encodedHash) {
        jdbc.sql("UPDATE users SET password_hash = :h WHERE id = :id").param("h", encodedHash).param("id", user).update();
    }

    public void makeAdmin(UUID id) {
        jdbc.sql("UPDATE users SET role = 'admin' WHERE id = :id").param("id", id).update();
    }

    public void follow(UUID follower, UUID followee) {
        jdbc.sql("INSERT INTO follows (follower_id, followee_id) VALUES (:a, :b)").param("a", follower).param("b", followee).update();
    }

    public void block(UUID blocker, UUID blocked) {
        jdbc.sql("INSERT INTO blocks (blocker_id, blocked_id) VALUES (:a, :b)").param("a", blocker).param("b", blocked).update();
    }

    /** A pending request to follow a private profile. */
    public void requestFollow(UUID follower, UUID followee) {
        jdbc.sql("INSERT INTO follow_requests (follower_id, followee_id) VALUES (:a, :b)").param("a", follower).param("b", followee).update();
    }

    /** A direct conversation created without the messaging rules (it may predate a block or a settings change). */
    public UUID directConversation(UUID a, UUID b) {
        UUID id = UUID.randomUUID();
        String key = a.compareTo(b) < 0 ? a + ":" + b : b + ":" + a;
        jdbc.sql("INSERT INTO conversations (id, kind, created_by, direct_key) VALUES (:id, 'direct', :a, :key)")
                .param("id", id).param("a", a).param("key", key).update();
        jdbc.sql("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (:c, :a, 'admin'), (:c, :b, 'member')")
                .param("c", id).param("a", a).param("b", b).update();
        return id;
    }

    public void lastSeen(UUID user, Instant at) {
        jdbc.sql("UPDATE users SET last_seen_at = :at WHERE id = :id").param("at", Timestamp.from(at)).param("id", user).update();
    }

    public void setPreference(UUID user, String column, Object value) {
        jdbc.sql("UPDATE user_preferences SET " + column + " = :v WHERE user_id = :id").param("v", value).param("id", user).update();
    }

    public void setLearning(UUID user, List<String> languages) {
        jdbc.sql("UPDATE users SET learning_languages = :l WHERE id = :id").param("l", languages.toArray(String[]::new)).param("id", user).update();
    }

    public void setCreatedAt(String table, UUID id, Instant at) {
        jdbc.sql("UPDATE " + table + " SET created_at = :at WHERE id = :id").param("at", Timestamp.from(at)).param("id", id).update();
    }

    public static RequestPostProcessor as(UUID userId) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new AppPrincipal(userId), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    public static RequestPostProcessor asAdmin(UUID userId) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new AppPrincipal(userId), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
}
