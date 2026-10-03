package com.tennotalk.users;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Wire types mirroring src/types/user.ts. */
public final class UserDtos {

    private UserDtos() {}

    public record UserDto(UUID id, String username, String displayName, String avatarUrl) {}

    public record UserProfileDto(
            UUID id,
            String username,
            String displayName,
            String avatarUrl,
            String bio,
            String country,
            String nativeLanguage,
            List<String> learningLanguages,
            long followersCount,
            long followingCount,
            long postsCount,
            boolean isFollowing,
            boolean isOnline,
            Instant lastSeenAt) {}

    public record CurrentUserDto(
            UUID id,
            String username,
            String displayName,
            String avatarUrl,
            String bio,
            String country,
            String nativeLanguage,
            List<String> learningLanguages,
            long followersCount,
            long followingCount,
            long postsCount,
            boolean isFollowing,
            boolean isOnline,
            Instant lastSeenAt,
            String email,
            String role,
            List<String> connectedProviders,
            String termsAcceptedVersion,
            Instant onboardingCompletedAt,
            Preferences preferences) {}

    public static UserDto user(UserRow row) {
        return new UserDto(row.id(), nullToEmpty(row.username()), row.displayName(), row.avatarUrl());
    }

    static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
