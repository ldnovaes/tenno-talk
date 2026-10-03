import type { LanguageCode } from "./language";

export type TranslationDisplayMode = "translation" | "both" | "original";

export interface TranslationPreference {
  receivingLanguage: LanguageCode;
  displayMode: TranslationDisplayMode;
  autoTranslatePosts: boolean;
  autoTranslateStories: boolean;
  learningMode: boolean;
}

export type Audience = "everyone" | "followers" | "nobody";

export interface PrivacyPreferences {
  profileVisibility: "public" | "private";
  whoCanMessage: Audience;
  whoCanComment: Audience;
}

export interface NotificationPreferences {
  messages: boolean;
  comments: boolean;
  likes: boolean;
  followers: boolean;
}

export interface UserPreferences {
  interfaceLanguage: LanguageCode;
  translation: TranslationPreference;
  privacy: PrivacyPreferences;
  notifications: NotificationPreferences;
}

export type ThemePreference = "light" | "dark" | "system";
