package com.tennotalk.feed;

/** SQL predicate: can :viewer see content authored by the row alias {@code a}? (blocks + private profiles). */
public final class Visibility {

    private Visibility() {}

    public static String followedAuthor(String authorColumn) {
        return "(" + authorColumn + " = :viewer OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = " + authorColumn + "))";
    }

    public static String authorVisible(String authorColumn) {
        return """
                (%1$s = :viewer OR (
                  NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = %1$s AND b.blocked_id = :viewer)
                                                       OR (b.blocker_id = :viewer AND b.blocked_id = %1$s))
                  AND (EXISTS (SELECT 1 FROM user_preferences vp WHERE vp.user_id = %1$s AND vp.profile_visibility = 'public')
                       OR EXISTS (SELECT 1 FROM follows vf WHERE vf.follower_id = :viewer AND vf.followee_id = %1$s))))
                """.formatted(authorColumn);
    }
}
