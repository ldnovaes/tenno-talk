package com.tennotalk.users;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    static final RowMapper<UserRow> ROW = UserRepository::map;

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    static List<String> strings(Array array) throws SQLException {
        return array == null ? List.of() : Arrays.asList((String[]) array.getArray());
    }

    private static UserRow map(ResultSet rs, int row) throws SQLException {
        return new UserRow(
                rs.getObject("id", UUID.class),
                rs.getString("role"),
                rs.getString("email"),
                rs.getString("password_hash"),
                rs.getString("username"),
                rs.getString("display_name"),
                rs.getString("avatar_url"),
                rs.getString("bio"),
                rs.getString("country"),
                rs.getString("native_language"),
                strings(rs.getArray("learning_languages")),
                instant(rs, "onboarding_completed_at"),
                instant(rs, "last_seen_at"),
                instant(rs, "created_at"));
    }

    public Optional<UserRow> findById(UUID id) {
        return jdbc.sql("SELECT * FROM users WHERE id = :id").param("id", id).query(ROW).optional();
    }

    public UserRow require(UUID id) {
        return findById(id).orElseThrow(() -> com.tennotalk.common.ApiException.unauthenticated("Your session has expired."));
    }

    public Optional<UserRow> findByEmail(String email) {
        return jdbc.sql("SELECT * FROM users WHERE email = :email").param("email", email).query(ROW).optional();
    }

    public Optional<UserRow> findByUsername(String username) {
        return jdbc.sql("SELECT * FROM users WHERE username = :username").param("username", username).query(ROW).optional();
    }

    public void insert(UUID id, String email, String passwordHash, String nativeLanguage) {
        jdbc.sql("""
                INSERT INTO users (id, email, password_hash, native_language)
                VALUES (:id, :email, :hash, :language)
                """)
                .param("id", id)
                .param("email", email)
                .param("hash", passwordHash)
                .param("language", nativeLanguage)
                .update();
        jdbc.sql("INSERT INTO user_preferences (user_id, receiving_language) VALUES (:id, :language)")
                .param("id", id)
                .param("language", nativeLanguage)
                .update();
    }

    public void updatePassword(UUID id, String hash) {
        jdbc.sql("UPDATE users SET password_hash = :hash WHERE id = :id").param("hash", hash).param("id", id).update();
    }

    public void updateProfile(UUID id, String displayName, String username, String bio, String country,
            String avatarUrl, String nativeLanguage, List<String> learning) {
        jdbc.sql("""
                UPDATE users SET display_name = :displayName, username = :username, bio = :bio, country = :country,
                       avatar_url = :avatarUrl, native_language = :nativeLanguage, learning_languages = :learning
                WHERE id = :id
                """)
                .param("displayName", displayName)
                .param("username", username)
                .param("bio", bio)
                .param("country", country)
                .param("avatarUrl", avatarUrl)
                .param("nativeLanguage", nativeLanguage)
                .param("learning", learning.toArray(String[]::new))
                .param("id", id)
                .update();
    }

    public void completeOnboarding(UUID id, Instant at) {
        jdbc.sql("UPDATE users SET onboarding_completed_at = :at WHERE id = :id AND onboarding_completed_at IS NULL")
                .param("at", java.sql.Timestamp.from(at))
                .param("id", id)
                .update();
    }

    public void touchLastSeen(UUID id, Instant at) {
        jdbc.sql("UPDATE users SET last_seen_at = :at WHERE id = :id").param("at", Timestamp.from(at)).param("id", id).update();
    }

    public void delete(UUID id) {
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", id).update();
    }

    public List<String> providers(UUID id, boolean hasPassword) {
        List<String> social = jdbc.sql("SELECT provider FROM oauth_accounts WHERE user_id = :id ORDER BY provider")
                .param("id", id)
                .query(String.class)
                .list();
        if (!hasPassword) return social;
        List<String> all = new java.util.ArrayList<>();
        all.add("password");
        all.addAll(social);
        return all;
    }

    public Optional<String> latestTermsVersion(UUID id) {
        return jdbc.sql("SELECT terms_version FROM terms_acceptances WHERE user_id = :id ORDER BY accepted_at DESC, id DESC LIMIT 1")
                .param("id", id)
                .query(String.class)
                .optional();
    }

    public void acceptTerms(UUID id, String version, String ip, String userAgent) {
        jdbc.sql("INSERT INTO terms_acceptances (user_id, terms_version, ip, user_agent) VALUES (:id, :version, :ip, :ua)")
                .param("id", id)
                .param("version", version)
                .param("ip", ip)
                .param("ua", userAgent)
                .update();
    }

    public boolean isAdmin(UUID id) {
        return jdbc.sql("SELECT role = 'admin' FROM users WHERE id = :id").param("id", id).query(Boolean.class).optional().orElse(false);
    }
}
