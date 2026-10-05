package com.tennotalk.users;

/**
 * SQL predicate: may {@code viewer} see whether {@code owner} is online and when they were last seen?
 * "Who can see when I'm online" (PLAN.md §31.1): everyone, people the owner follows, or nobody; never across a block.
 */
public final class PresenceVisibility {

    private PresenceVisibility() {}

    public static String visibleTo(String viewer, String owner) {
        return """
                (%1$s = %2$s OR (
                  NOT EXISTS (SELECT 1 FROM blocks pb WHERE (pb.blocker_id = %1$s AND pb.blocked_id = %2$s)
                                                        OR (pb.blocker_id = %2$s AND pb.blocked_id = %1$s))
                  AND EXISTS (SELECT 1 FROM user_preferences pp WHERE pp.user_id = %2$s
                              AND (pp.who_can_see_online = 'everyone'
                                   OR (pp.who_can_see_online = 'followers' AND EXISTS (
                                       SELECT 1 FROM follows pf WHERE pf.follower_id = %2$s AND pf.followee_id = %1$s))))))
                """.formatted(viewer, owner);
    }
}
