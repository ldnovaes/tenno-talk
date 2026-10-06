package com.tennotalk.media;

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

@Repository
public class MediaRepository {

    private final JdbcClient jdbc;

    public MediaRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    static MediaRow map(ResultSet rs, int row) throws SQLException {
        return new MediaRow(
                rs.getObject("id", UUID.class),
                rs.getObject("owner_id", UUID.class),
                rs.getString("kind"),
                rs.getString("mime_type"),
                rs.getLong("size_bytes"),
                (Integer) rs.getObject("width"),
                (Integer) rs.getObject("height"),
                (Integer) rs.getObject("duration_ms"),
                rs.getString("storage_path"),
                rs.getString("original_name"),
                rs.getTimestamp("created_at").toInstant());
    }

    public void insert(MediaRow media) {
        jdbc.sql("""
                INSERT INTO media (id, owner_id, kind, mime_type, size_bytes, width, height, duration_ms, storage_path, original_name)
                VALUES (:id, :owner, :kind, :mime, :size, :width, :height, :duration, :path, :name)
                """)
                .param("id", media.id())
                .param("owner", media.ownerId())
                .param("kind", media.kind())
                .param("mime", media.mimeType())
                .param("size", media.sizeBytes())
                .param("width", media.width())
                .param("height", media.height())
                .param("duration", media.durationMs())
                .param("path", media.storagePath())
                .param("name", media.originalName())
                .update();
    }

    /** Bytes an owner stores: in total and uploaded in the last 24 hours (quotas, PLAN.md §38). */
    public record Usage(long total, long lastDay) {}

    public Usage usage(UUID owner, Instant dayAgo) {
        return jdbc.sql("""
                SELECT coalesce(sum(size_bytes), 0) AS total,
                       coalesce(sum(size_bytes) FILTER (WHERE created_at > :since), 0) AS last_day
                FROM media WHERE owner_id = :owner
                """)
                .param("owner", owner)
                .param("since", Timestamp.from(dayAgo))
                .query((rs, row) -> new Usage(rs.getLong("total"), rs.getLong("last_day")))
                .single();
    }

    /**
     * Deletes up to {@code limit} files nobody uses: uploaded before {@code uploadedBefore} and not in a message,
     * a post, an avatar or a story that ended after {@code storiesEndedBefore}. Returns their storage paths.
     * Deleting the media also deletes the old stories that pointed to it (ON DELETE CASCADE).
     */
    public List<String> deleteUnused(Instant uploadedBefore, Instant storiesEndedBefore, int limit) {
        return jdbc.sql("""
                DELETE FROM media WHERE id IN (
                    SELECT m.id FROM media m
                    WHERE m.created_at < :uploaded
                      AND NOT EXISTS (SELECT 1 FROM message_media mm WHERE mm.media_id = m.id)
                      AND NOT EXISTS (SELECT 1 FROM post_media pm WHERE pm.media_id = m.id)
                      AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.media_id = m.id AND s.expires_at > :stories)
                      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_url = '/api/media/' || m.id)
                      AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.avatar_url = '/api/media/' || m.id)
                    LIMIT :limit)
                RETURNING storage_path
                """)
                .param("uploaded", Timestamp.from(uploadedBefore))
                .param("stories", Timestamp.from(storiesEndedBefore))
                .param("limit", limit)
                .query(String.class)
                .list();
    }

    public Optional<MediaRow> find(UUID id) {
        return jdbc.sql("SELECT * FROM media WHERE id = :id").param("id", id).query(MediaRepository::map).optional();
    }

    public List<MediaRow> findMany(Collection<UUID> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.sql("SELECT * FROM media WHERE id IN (:ids)").param("ids", ids).query(MediaRepository::map).list();
    }

    public List<MediaRow> findOwned(UUID owner, Collection<UUID> ids) {
        if (ids.isEmpty()) return List.of();
        return jdbc.sql("SELECT * FROM media WHERE owner_id = :owner AND id IN (:ids)")
                .param("owner", owner)
                .param("ids", ids)
                .query(MediaRepository::map)
                .list();
    }

    /** message id → its media in order. */
    public Map<UUID, List<MediaRow>> forMessages(Collection<UUID> messageIds) {
        return grouped("SELECT mm.message_id AS ref, m.* FROM message_media mm JOIN media m ON m.id = mm.media_id "
                + "WHERE mm.message_id IN (:ids) ORDER BY mm.position", messageIds);
    }

    public Map<UUID, List<MediaRow>> forPosts(Collection<UUID> postIds) {
        return grouped("SELECT pm.post_id AS ref, m.* FROM post_media pm JOIN media m ON m.id = pm.media_id "
                + "WHERE pm.post_id IN (:ids) ORDER BY pm.position", postIds);
    }

    private Map<UUID, List<MediaRow>> grouped(String sql, Collection<UUID> ids) {
        Map<UUID, List<MediaRow>> result = new HashMap<>();
        if (ids.isEmpty()) return result;
        jdbc.sql(sql).param("ids", ids).query((rs, row) -> {
            result.computeIfAbsent(rs.getObject("ref", UUID.class), key -> new ArrayList<>()).add(map(rs, row));
            return null;
        }).list();
        return result;
    }

    /**
     * Who may download a file: the owner, members of a conversation where it was sent,
     * anyone who can see the post or story, and anyone for avatars (PLAN.md §29).
     */
    public boolean canView(UUID viewer, UUID mediaId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM media m WHERE m.id = :media AND m.owner_id = :viewer)
                    OR EXISTS (SELECT 1 FROM message_media mm
                               JOIN messages msg ON msg.id = mm.message_id
                               JOIN conversation_members cm ON cm.conversation_id = msg.conversation_id AND cm.user_id = :viewer
                               WHERE mm.media_id = :media)
                    OR EXISTS (SELECT 1 FROM post_media pm JOIN posts p ON p.id = pm.post_id
                               JOIN user_preferences up ON up.user_id = p.author_id
                               WHERE pm.media_id = :media
                                 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = p.author_id AND b.blocked_id = :viewer)
                                                                         OR (b.blocker_id = :viewer AND b.blocked_id = p.author_id))
                                 AND (up.profile_visibility = 'public' OR p.author_id = :viewer
                                      OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = p.author_id)))
                    OR EXISTS (SELECT 1 FROM stories s
                               JOIN user_preferences up ON up.user_id = s.author_id
                               WHERE s.media_id = :media AND s.expires_at > now()
                                 AND (s.author_id = :viewer OR (
                                   NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = s.author_id AND b.blocked_id = :viewer)
                                                                           OR (b.blocker_id = :viewer AND b.blocked_id = s.author_id))
                                   AND (up.profile_visibility = 'public' OR EXISTS (
                                       SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = s.author_id)))))
                    OR EXISTS (SELECT 1 FROM users u WHERE u.avatar_url = '/api/media/' || :mediaText)
                """)
                .param("media", mediaId)
                .param("mediaText", mediaId.toString())
                .param("viewer", viewer)
                .query(Boolean.class)
                .single();
    }
}
