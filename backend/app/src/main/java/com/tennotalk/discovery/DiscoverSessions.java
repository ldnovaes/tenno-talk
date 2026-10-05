package com.tennotalk.discovery;

import java.sql.Array;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Ranked snapshots (PLAN.md §37.6): a session is ranked once and then sliced, so pages never repeat or skip. */
@Component
class DiscoverSessions {

    record Snapshot(UUID id, List<UUID> postIds) {

        int size() {
            return postIds.size();
        }
    }

    private final JdbcClient jdbc;
    private final DiscoverProperties properties;

    DiscoverSessions(JdbcClient jdbc, DiscoverProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    Snapshot create(UUID viewer, UUID id, List<UUID> postIds, Instant now) {
        String[] ids = postIds.stream().map(UUID::toString).toArray(String[]::new);
        jdbc.sql("""
                INSERT INTO discover_sessions (id, user_id, post_ids, created_at, expires_at)
                VALUES (:id, :user, CAST(:ids AS uuid[]), :now, :expires)
                """).param("id", id).param("user", viewer).param("ids", ids).param("now", Timestamp.from(now))
                .param("expires", Timestamp.from(now.plus(properties.sessionTtl()))).update();
        return new Snapshot(id, List.copyOf(postIds));
    }

    /** The viewer's own, unexpired session. */
    Optional<Snapshot> find(UUID viewer, UUID id, Instant now) {
        return jdbc.sql("SELECT post_ids FROM discover_sessions WHERE id = :id AND user_id = :user AND expires_at > :now")
                .param("id", id).param("user", viewer).param("now", Timestamp.from(now))
                .query((rs, row) -> new Snapshot(id, uuids(rs.getArray("post_ids")))).optional();
    }

    int deleteExpired(Instant now) {
        return jdbc.sql("DELETE FROM discover_sessions WHERE expires_at <= :now").param("now", Timestamp.from(now)).update();
    }

    private static List<UUID> uuids(Array array) throws SQLException {
        List<UUID> result = new ArrayList<>();
        if (array == null) return result;
        for (Object value : (Object[]) array.getArray()) {
            if (value instanceof UUID uuid) result.add(uuid);
            else if (value != null) result.add(UUID.fromString(value.toString()));
        }
        return result;
    }
}
