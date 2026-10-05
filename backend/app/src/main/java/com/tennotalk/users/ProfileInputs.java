package com.tennotalk.users;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies (mirrors src/services/profileService.ts). */
public final class ProfileInputs {

    private ProfileInputs() {}

    public record AcceptTerms(@NotBlank String version) {}

    public record CompleteOnboarding(
            @NotBlank String nativeLanguage,
            @NotBlank String receivingLanguage,
            @NotBlank @Size(max = 40) String displayName,
            @NotBlank String username,
            @Size(max = 160) String bio,
            @NotBlank @Size(min = 2, max = 2) String country,
            String avatarUrl) {}

    public record UpdateProfile(
            @NotBlank @Size(max = 40) String displayName,
            @NotBlank String username,
            @Size(max = 160) String bio,
            @NotBlank @Size(min = 2, max = 2) String country,
            String avatarUrl,
            @NotBlank String nativeLanguage,
            @NotNull @Size(max = 5) List<String> learningLanguages) {}

    /** Partial update: any null part keeps the current value. */
    public record PreferencesPatch(
            String interfaceLanguage, TranslationPatch translation, PrivacyPatch privacy, NotificationsPatch notifications) {}

    public record TranslationPatch(
            String receivingLanguage,
            String displayMode,
            Boolean autoTranslatePosts,
            Boolean autoTranslateStories,
            Boolean learningMode) {}

    public record PrivacyPatch(String profileVisibility, String whoCanMessage, String whoCanComment) {}

    public record NotificationsPatch(Boolean messages, Boolean comments, Boolean likes, Boolean followers) {}
}
