import type { PreferencesPatch, UserPreferences } from "@/types/preferences";

export const DEFAULT_PREFERENCES: UserPreferences = {
  interfaceLanguage: "en-US",
  translation: {
    receivingLanguage: "en-US",
    displayMode: "translation",
    autoTranslatePosts: true,
    autoTranslateStories: true,
    learningMode: false,
  },
  privacy: {
    profileVisibility: "public",
    whoCanMessage: "everyone",
    whoCanComment: "everyone",
    whoCanSeeOnline: "everyone",
  },
  notifications: { messages: true, comments: true, likes: true, followers: true },
};

/** Applies a partial update; groups merge field by field, absent keys keep their value. */
export function mergePreferences(
  current: UserPreferences,
  patch: PreferencesPatch,
): UserPreferences {
  return {
    interfaceLanguage: patch.interfaceLanguage ?? current.interfaceLanguage,
    translation: { ...current.translation, ...patch.translation },
    privacy: { ...current.privacy, ...patch.privacy },
    notifications: { ...current.notifications, ...patch.notifications },
  };
}
