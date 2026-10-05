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

    public boolean requested(UUID follower, UUID followee) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM follow_requests WHERE follower_id = :a AND followee_id = :b)")
                .param("a", follower).param("b", followee).query(Boolean.class).single();
    }

    public boolean requestFollow(UUID follower, UUID followee) {
        return jdbc.sql("INSERT INTO follow_requests (follower_id, followee_id) VALUES (:a, :b) ON CONFLICT DO NOTHING")
                .param("a", follower).param("b", followee).update() > 0;
    }

    public boolean approveFollow(UUID follower, UUID followee) {
        int approved = jdbc.sql("DELETE FROM follow_requests WHERE follower_id = :a AND followee_id = :b")
                .param("a", follower).param("b", followee).update();
        if (approved > 0) follow(follower, followee);
        return approved > 0;
    }

    public void rejectFollow(UUID follower, UUID followee) {
        jdbc.sql("DELETE FROM follow_requests WHERE follower_id = :a AND followee_id = :b")
                .param("a", follower).param("b", followee).update();
    }

    /** Pending requests become normal follows when the owner makes the profile public. */
    public void approveAll(UUID followee) {
        jdbc.sql("""
                INSERT INTO follows (follower_id, followee_id)
                SELECT r.follower_id, r.followee_id FROM follow_requests r
                WHERE r.followee_id = :b AND NOT EXISTS (
                    SELECT 1 FROM blocks x WHERE (x.blocker_id = r.follower_id AND x.blocked_id = :b)
                                            OR (x.blocker_id = :b AND x.blocked_id = r.follower_id))
                ON CONFLICT DO NOTHING
                """).param("b", followee).update();
        jdbc.sql("DELETE FROM follow_requests WHERE followee_id = :b").param("b", followee).update();
    }

    public void unfollow(UUID follower, UUID followee) {
        jdbc.sql("DELETE FROM follows WHERE follower_id = :a AND followee_id = :b").param("a", follower).param("b", followee).update();
        rejectFollow(follower, followee);
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

    /** Serializes a direct send and a block of the same pair until their transactions commit. */
    public void lockPair(UUID a, UUID b) {
        String pair = a.compareTo(b) < 0 ? a + ":" + b : b + ":" + a;
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended(:pair, 0))")
                .param("pair", pair).query((rs, row) -> true).single();
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
        jdbc.sql("""
                DELETE FROM follow_requests WHERE (follower_id = :a AND followee_id = :b) OR (follower_id = :b AND followee_id = :a)
                """).param("a", blocker).param("b", blocked).update();
    }

    public void unblock(UUID blocker, UUID blocked) {
        jdbc.sql("DELETE FROM blocks WHERE blocker_id = :a AND blocked_id = :b").param("a", blocker).param("b", blocked).update();
    }
}
