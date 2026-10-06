package com.tennotalk.db;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import com.tennotalk.support.IntegrationTest;
import com.tennotalk.support.TestcontainersConfig;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Migrations over real data (PLAN.md §27): production was created at older versions, so each data backfill runs
 * on rows written by the schema of its time, in a database of its own on the test server.
 */
class MigrationDataIT extends IntegrationTest {

    private String database;
    private DataSource source;
    private JdbcClient old;

    @BeforeEach
    void freshDatabase() {
        database = "migrations_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.sql("CREATE DATABASE " + database).update();
        var container = TestcontainersConfig.container();
        String url = container.getJdbcUrl().replaceFirst("/[^/?]+(\\?|$)", "/" + database + "$1");
        source = new DriverManagerDataSource(url, container.getUsername(), container.getPassword());
        old = JdbcClient.create(source);
    }

    @AfterEach
    void dropDatabase() {
        jdbc.sql("DROP DATABASE IF EXISTS " + database + " WITH (FORCE)").update();
    }

    private void migrateTo(String version) {
        var flyway = Flyway.configure().dataSource(source).locations("classpath:db/migration");
        (version == null ? flyway : flyway.target(version)).load().migrate();
    }

    private UUID user(String name, String language, Instant createdAt) {
        UUID id = UUID.randomUUID();
        old.sql("INSERT INTO users (id, email, username, display_name, native_language, created_at) VALUES (:id, :e, :u, :u, :l, :at)")
                .param("id", id).param("e", name + "@example.com").param("u", name).param("l", language)
                .param("at", Timestamp.from(createdAt)).update();
        old.sql("INSERT INTO user_preferences (user_id, receiving_language) VALUES (:id, :l)").param("id", id).param("l", language).update();
        return id;
    }

    @Test
    void everyBackfillKeepsTheMeaningOfOldData() {
        Instant start = Instant.now().minus(30, ChronoUnit.DAYS);
        migrateTo("2");
        UUID rafael = user("rafael", "pt-BR", start), linh = user("linh", "vi-VN", start.plusSeconds(60));

        // V3: a job parked while the old CLIs were logged out
        UUID someMessage = UUID.randomUUID();
        old.sql("INSERT INTO translation_jobs (kind, ref_id, target_language, status) VALUES ('message', :r, 'vi-VN', 'waiting_provider')")
                .param("r", someMessage).update();

        // V5: three messages; linh read up to the second
        UUID conversation = UUID.randomUUID();
        old.sql("INSERT INTO conversations (id, kind, created_by, direct_key) VALUES (:id, 'direct', :a, :k)")
                .param("id", conversation).param("a", rafael).param("k", rafael + ":" + linh).update();
        UUID[] messages = {UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID()};
        for (int n = 0; n < messages.length; n++) {
            old.sql("INSERT INTO messages (id, conversation_id, sender_id, client_id, type, original_text, original_language, created_at) "
                            + "VALUES (:id, :c, :s, :k, 'text', 'Oi', 'pt-BR', :at)")
                    .param("id", messages[n]).param("c", conversation).param("s", rafael).param("k", "k" + n)
                    .param("at", Timestamp.from(start.plusSeconds(3600 + n))).update();
        }
        old.sql("INSERT INTO conversation_members (conversation_id, user_id, role, last_read_message_id, last_delivered_message_id) "
                        + "VALUES (:c, :a, 'admin', NULL, NULL), (:c, :b, 'member', :read, :delivered)")
                .param("c", conversation).param("a", rafael).param("b", linh).param("read", messages[1]).param("delivered", messages[2]).update();

        // V7: a recent captioned post with 2 likes and 1 comment, and an old captioned post
        UUID recent = UUID.randomUUID(), older = UUID.randomUUID();
        old.sql("INSERT INTO posts (id, author_id, caption_text, caption_language, created_at) VALUES (:id, :a, 'Praia', 'pt-BR', now())")
                .param("id", recent).param("a", rafael).update();
        old.sql("INSERT INTO posts (id, author_id, caption_text, caption_language, created_at) VALUES (:id, :a, 'Antiga', 'pt-BR', :at)")
                .param("id", older).param("a", rafael).param("at", Timestamp.from(start)).update();
        old.sql("INSERT INTO likes (post_id, user_id) VALUES (:p, :a), (:p, :b)").param("p", recent).param("a", rafael).param("b", linh).update();
        old.sql("INSERT INTO comments (id, post_id, author_id, body_text, body_language) VALUES (:id, :p, :a, 'Lindo', 'vi-VN')")
                .param("id", UUID.randomUUID()).param("p", recent).param("a", linh).update();

        migrateTo("9");

        assertThat(old.sql("SELECT status FROM translation_jobs").query(String.class).single()).as("V3 resumes parked jobs").isEqualTo("pending");
        assertThat(old.sql("SELECT provider FROM ai_provider_status ORDER BY provider").query(String.class).list())
                .as("V3 providers").containsExactly("anthropic", "openai");

        var history = old.sql("SELECT user_id, language, since FROM receiving_language_history ORDER BY since")
                .query((rs, i) -> rs.getString("language") + "@" + rs.getTimestamp("since").toInstant().truncatedTo(ChronoUnit.SECONDS)).list();
        assertThat(history).as("V4 baseline: the current language since the account was created").containsExactly(
                "pt-BR@" + start.truncatedTo(ChronoUnit.SECONDS), "vi-VN@" + start.plusSeconds(60).truncatedTo(ChronoUnit.SECONDS));

        for (int n = 0; n < messages.length; n++) {
            var receipt = old.sql("SELECT delivered_at IS NOT NULL AS delivered, read_at IS NOT NULL AS read FROM message_receipts "
                            + "WHERE message_id = :m AND recipient_id = :r")
                    .param("m", messages[n]).param("r", linh).query((rs, i) -> rs.getBoolean("delivered") + "/" + rs.getBoolean("read")).single();
            // Only real reads survive; the old optimistic "delivered" cursor never becomes a confirmed receipt.
            assertThat(receipt).as("V5 receipt of message " + n).isEqualTo(n <= 1 ? "true/true" : "false/false");
        }
        assertThat(old.sql("SELECT count(*) FROM message_receipts WHERE recipient_id = :s").param("s", rafael).query(Long.class).single())
                .as("no receipt for the sender's own messages").isZero();

        var stats = old.sql("SELECT likes || '/' || comments FROM post_stats WHERE post_id = :p").param("p", recent).query(String.class).single();
        assertThat(stats).as("V7 counters").isEqualTo("2/1");
        assertThat(old.sql("SELECT post_id FROM classification_jobs").query(UUID.class).list())
                .as("V7 classifies only recent captions").containsExactly(recent);
    }

    @Test
    void duplicateOpenReportsCollapseIntoTheOldestOne() {
        migrateTo("9");
        UUID ana = user("ana", "es-ES", Instant.now()), target = user("spammer", "en-US", Instant.now());
        Instant at = Instant.parse("2026-10-01T10:00:00Z");
        UUID first = UUID.randomUUID();
        for (int n = 0; n < 4; n++) {
            old.sql("INSERT INTO reports (id, reporter_id, target_kind, target_id, reason, status, created_at) "
                            + "VALUES (:id, :r, 'user', :t, 'spam', :s, :at)")
                    .param("id", n == 0 ? first : UUID.randomUUID()).param("r", ana).param("t", target)
                    .param("s", n == 3 ? "reviewed" : "open").param("at", Timestamp.from(at.plusSeconds(n))).update();
        }

        migrateTo(null);

        assertThat(old.sql("SELECT id FROM reports WHERE status = 'open'").query(UUID.class).list()).containsExactly(first);
        assertThat(old.sql("SELECT count(*) FROM reports WHERE status = 'dismissed'").query(Long.class).single()).isEqualTo(2);
        assertThat(old.sql("SELECT count(*) FROM reports WHERE status = 'reviewed'").query(Long.class).single()).as("untouched").isOne();
    }
}
