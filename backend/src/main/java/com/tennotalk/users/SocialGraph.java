package com.tennotalk.users;

import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Follows and blocks. Blocking is checked in BOTH directions everywhere. */
@Repository
public class SocialGraph {

    private final JdbcClient jdbc;

    public SocialGraph(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean follows(UUID follower, UUID followee) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = :a AND followee_id = :b)")
                .param("a", follower)
                .param("b", followee)
                .query(Boolean.class)
                .single();
    }

    public boolean follow(UUID follower, UUID followee) {
        return jdbc.sql("INSERT INTO follows (follower_id, followee_id) VALUES (:a, :b) ON CONFLICT DO NOTHING")
                .param("a", follower)
                .param("b", followee)
                .update() > 0;
    }

    public void unfollow(UUID follower, UUID followee) {
        jdbc.sql("DELETE FROM follows WHERE follower_id = :a AND followee_id = :b").param("a", follower).param("b", followee).update();
    }

    public boolean blockedEitherWay(UUID a, UUID b) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM blocks
                               WHERE (blocker_id = :a AND blocked_id = :b) OR (blocker_id = :b AND blocked_id = :a))
                """)
                .param("a", a)
                .param("b", b)
                .query(Boolean.class)
                .single();
    }

    public boolean hasBlocked(UUID blocker, UUID blocked) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = :a AND blocked_id = :b)")
                .param("a", blocker)
                .param("b", blocked)
                .query(Boolean.class)
                .single();
    }

    public void block(UUID blocker, UUID blocked) {
        jdbc.sql("INSERT INTO blocks (blocker_id, blocked_id) VALUES (:a, :b) ON CONFLICT DO NOTHING")
                .param("a", blocker)
                .param("b", blocked)
                .update();
        jdbc.sql("""
                DELETE FROM follows WHERE (follower_id = :a AND followee_id = :b) OR (follower_id = :b AND followee_id = :a)
                """)
                .param("a", blocker)
                .param("b", blocked)
                .update();
    }

    public void unblock(UUID blocker, UUID blocked) {
        jdbc.sql("DELETE FROM blocks WHERE blocker_id = :a AND blocked_id = :b").param("a", blocker).param("b", blocked).update();
    }
}
