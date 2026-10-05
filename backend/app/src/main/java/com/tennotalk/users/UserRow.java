package com.tennotalk.users;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserRow(
        UUID id,
        String role,
        String email,
        String passwordHash,
        String username,
        String displayName,
        String avatarUrl,
        String bio,
        String country,
        String nativeLanguage,
        List<String> learningLanguages,
        Instant onboardingCompletedAt,
        Instant lastSeenAt,
        Instant createdAt) {

    public boolean onboarded() {
        return onboardingCompletedAt != null;
    }
}
