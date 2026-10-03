import type { UserPreferences } from "@/types/preferences";

export const DEFAULT_PREFERENCES: UserPreferences = {
  interfaceLanguage: "en-US",
  translation: {
    receivingLanguage: "en-US",
    displayMode: "translation",
    autoTranslatePosts: true,
    autoTranslateStories: true,
    learningMode: false,
  },
  privacy: { profileVisibility: "public", whoCanMessage: "everyone", whoCanComment: "everyone" },
  notifications: { messages: true, comments: true, likes: true, followers: true },
};
