package com.tennotalk.moderation;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.common.ApiException;
import com.tennotalk.common.Ids;
import com.tennotalk.feed.Visibility;

/** Reports from people, reviewed by an admin (PLAN.md §31). The reporter must be able to see what they report. */
@Service
public class ReportService {

    public static final Set<String> KINDS = Set.of("user", "message", "post", "comment", "story");
    public static final Set<String> REASONS = Set.of("spam", "harassment", "hate", "sexual", "violence", "other");
    public static final Set<String> STATUSES = Set.of("open", "reviewed", "dismissed");

    public record ReportDto(UUID id, String targetKind, UUID targetId, String reason, String status, Instant createdAt,
            UUID reporterId, String reporterUsername) {}

    private final JdbcClient jdbc;
    private final Clock clock;

    public ReportService(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public ReportDto report(UUID reporter, String kind, UUID targetId, String reason) {
        if (!KINDS.contains(kind)) throw ApiException.validation("Unknown content.", "targetKind", "invalid");
        if (!REASONS.contains(reason)) throw ApiException.validation("Pick a reason.", "reason", "invalid");
        UUID owner = ownerOfVisible(reporter, kind, targetId).orElseThrow(() -> ApiException.notFound("Not found."));
        if (owner.equals(reporter)) throw ApiException.validation("You can't report yourself.");

        Optional<UUID> open = jdbc.sql("""
                SELECT id FROM reports WHERE reporter_id = :r AND target_kind = :k AND target_id = :t AND status = 'open'
                """).param("r", reporter).param("k", kind).param("t", targetId).query(UUID.class).optional();
        UUID id = open.orElseGet(() -> {
            UUID created = Ids.newId();
            jdbc.sql("""
                    INSERT INTO reports (id, reporter_id, target_kind, target_id, reason, created_at)
                    VALUES (:id, :r, :k, :t, :reason, :at)
                    """).param("id", created).param("r", reporter).param("k", kind).param("t", targetId)
                    .param("reason", reason).param("at", Timestamp.from(clock.instant())).update();
            return created;
        });
        return find(id).orElseThrow();
    }

    /** Who owns the target, if the reporter can see it. */
    private Optional<UUID> ownerOfVisible(UUID viewer, String kind, UUID id) {
        String sql = switch (kind) {
            case "user" -> "SELECT u.id FROM users u WHERE u.id = :id";
            case "message" -> """
                    SELECT m.sender_id FROM messages m
                    JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = :viewer
                    WHERE m.id = :id""";
            case "post" -> "SELECT p.author_id FROM posts p WHERE p.id = :id AND " + Visibility.authorVisible("p.author_id");
            case "comment" -> "SELECT c.author_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = :id AND "
                    + Visibility.authorVisible("p.author_id");
            case "story" -> "SELECT s.author_id FROM stories s WHERE s.id = :id AND " + Visibility.authorVisible("s.author_id");
            default -> throw new IllegalArgumentException(kind);
        };
        return jdbc.sql(sql).param("id", id).param("viewer", viewer).query(UUID.class).optional();
    }

    private static final String SELECT = """
            SELECT r.*, u.username FROM reports r JOIN users u ON u.id = r.reporter_id
            """;

    private static ReportDto map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new ReportDto(rs.getObject("id", UUID.class), rs.getString("target_kind"), rs.getObject("target_id", UUID.class),
                rs.getString("reason"), rs.getString("status"), rs.getTimestamp("created_at").toInstant(),
                rs.getObject("reporter_id", UUID.class), rs.getString("username"));
    }

    private Optional<ReportDto> find(UUID id) {
        return jdbc.sql(SELECT + " WHERE r.id = :id").param("id", id).query(ReportService::map).optional();
    }

    @Transactional(readOnly = true)
    public List<ReportDto> list(String status) {
        if (!STATUSES.contains(status)) throw ApiException.validation("Unknown status.");
        return jdbc.sql(SELECT + " WHERE r.status = :s ORDER BY r.created_at DESC LIMIT 200").param("s", status)
                .query(ReportService::map).list();
    }

    @Transactional
    public ReportDto resolve(UUID id, String status) {
        if (!"reviewed".equals(status) && !"dismissed".equals(status)) {
            throw ApiException.validation("Use reviewed or dismissed.", "status", "invalid");
        }
        int updated = jdbc.sql("UPDATE reports SET status = :s WHERE id = :id").param("s", status).param("id", id).update();
        if (updated == 0) throw ApiException.notFound("Report not found.");
        return find(id).orElseThrow();
    }
}
