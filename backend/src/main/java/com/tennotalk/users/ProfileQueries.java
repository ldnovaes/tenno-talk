package com.tennotalk.users;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import com.tennotalk.common.Presence;
import com.tennotalk.users.UserDtos.UserProfileDto;

/** Profiles projected for a viewer (counts, isFollowing, live presence). */
@Component
public class ProfileQueries {

    private static final String SELECT = """
            SELECT u.*,
                   (SELECT count(*) FROM follows f WHERE f.followee_id = u.id) AS followers_count,
                   (SELECT count(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
                   (SELECT count(*) FROM posts p WHERE p.author_id = u.id) AS posts_count,
                   EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id) AS is_following
            FROM users u
            """;

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
                    return new UserProfileDto(
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
                            presence.isOnline(user.id()),
                            user.lastSeenAt());
                })
                .list();
    }

    public Optional<UserProfileDto> byId(UUID viewer, UUID id) {
        return list(viewer, "u.id = :id", Map.of("id", id)).stream().findFirst();
    }
}
