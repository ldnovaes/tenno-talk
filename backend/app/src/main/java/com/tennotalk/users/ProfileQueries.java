package com.tennotalk.users;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import com.tennotalk.common.Presence;
import com.tennotalk.users.UserDtos.UserProfileDto;

/** Profiles projected for a viewer (counts, isFollowing, block status, presence the owner lets the viewer see). */
@Component
public class ProfileQueries {

    private static final String SELECT = """
            SELECT u.*,
                   (SELECT count(*) FROM follows f WHERE f.followee_id = u.id) AS followers_count,
                   (SELECT count(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
                   (SELECT count(*) FROM posts p WHERE p.author_id = u.id) AS posts_count,
                   EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id) AS is_following,
                   (SELECT p.profile_visibility = 'private' FROM user_preferences p WHERE p.user_id = u.id) AS is_private,
                   EXISTS (SELECT 1 FROM follow_requests r WHERE r.follower_id = :viewer AND r.followee_id = u.id) AS follow_request_pending,
                   %s AS presence_visible,
                   CASE WHEN EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = :viewer AND b.blocked_id = u.id) THEN 'blocked_by_me'
                        WHEN EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = u.id AND b.blocked_id = :viewer) THEN 'blocked_me'
                        ELSE 'none' END AS block_status
            FROM users u
            """.formatted(PresenceVisibility.visibleTo(":viewer", "u.id"));

    /** Viewer-visible people: onboarded, not the viewer, no block in either direction. */
    public static final String VISIBLE_TO_VIEWER = """
            u.onboarding_completed_at IS NOT NULL AND u.id <> :viewer
            AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = :viewer AND b.blocked_id = u.id)
                                                     OR (b.blocker_id = u.id AND b.blocked_id = :viewer))
            """;

    private final JdbcClient jdbc;
    private final Presence presence;

    public ProfileQueries(JdbcClient jdbc, Presence presence) {
        this.jdbc = jdbc;
        this.presence = presence;
    }

    public List<UserProfileDto> list(UUID viewer, String whereAndOrder, Map<String, ?> params) {
        return jdbc.sql(SELECT + " WHERE " + whereAndOrder)
                .param("viewer", viewer)
                .params(params)
                .query((rs, row) -> {
                    UserRow user = UserRepository.ROW.mapRow(rs, row);
                    boolean showPresence = rs.getBoolean("presence_visible");
                    return redact(new UserProfileDto(
                            user.id(),
                            UserDtos.nullToEmpty(user.username()),
                            user.displayName(),
                            user.avatarUrl(),
                            user.bio(),
                            user.country(),
                            user.nativeLanguage(),
                            user.learningLanguages(),
                            rs.getLong("followers_count"),
                            rs.getLong("following_count"),
                            rs.getLong("posts_count"),
                            rs.getBoolean("is_following"),
                            rs.getBoolean("is_private"),
                            rs.getBoolean("follow_request_pending"),
                            showPresence && presence.isOnline(user.id()),
                            showPresence ? user.lastSeenAt() : null,
                            rs.getString("block_status")));
                })
                .list();
    }

    /**
     * What a block leaves of a profile (PLAN.md §31.1): the blocker sees it without presence or follow state; the
     * blocked person sees only who it is (name, username, avatar, country and native language).
     */
    static UserProfileDto redact(UserProfileDto p) {
        return switch (p.blockStatus()) {
            case "blocked_by_me" -> new UserProfileDto(p.id(), p.username(), p.displayName(), p.avatarUrl(), p.bio(), p.country(),
                    p.nativeLanguage(), p.learningLanguages(), p.followersCount(), p.followingCount(), p.postsCount(), false,
                    p.isPrivate(), false, false, null, p.blockStatus());
            case "blocked_me" -> new UserProfileDto(p.id(), p.username(), p.displayName(), p.avatarUrl(), null, p.country(),
                    p.nativeLanguage(), List.of(), 0, 0, 0, false, false, false, false, null, p.blockStatus());
            default -> p;
        };
    }

    public Optional<UserProfileDto> byId(UUID viewer, UUID id) {
        return list(viewer, "u.id = :id", Map.of("id", id)).stream().findFirst();
    }
}
