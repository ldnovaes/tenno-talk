package com.tennotalk.users;

/** Account preferences; JSON shape equals the frontend {@code UserPreferences}. */
public record Preferences(String interfaceLanguage, Translation translation, Privacy privacy, Notifications notifications) {

    public record Translation(
            String receivingLanguage,
            String displayMode,
            boolean autoTranslatePosts,
            boolean autoTranslateStories,
            boolean learningMode) {}

    public record Privacy(String profileVisibility, String whoCanMessage, String whoCanComment) {}

    public record Notifications(boolean messages, boolean comments, boolean likes, boolean followers) {}
}
