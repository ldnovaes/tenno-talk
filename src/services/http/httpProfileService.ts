import type { ProfileService } from "@/services/profileService";
import type { CurrentUser, UserProfile } from "@/types/user";

import { http } from "./httpClient";
import { resolveAvatarUrl } from "./media";

const user = (id: string) => `/api/profiles/${encodeURIComponent(id)}`;

export const httpProfileService: ProfileService = {
  getMe: () => http<CurrentUser>("GET", "/api/me"),

  acceptTerms: (version) => http<CurrentUser>("POST", "/api/me/terms", { body: { version } }),

  checkUsername: (username) =>
    http<{ available: boolean }>(
      "GET",
      `/api/usernames/${encodeURIComponent(username)}/availability`,
    ),

  async completeOnboarding(input) {
    const avatarUrl = await resolveAvatarUrl(input.avatarUrl);
    return http<CurrentUser>("POST", "/api/me/onboarding", { body: { ...input, avatarUrl } });
  },

  async updateProfile(input) {
    const avatarUrl = await resolveAvatarUrl(input.avatarUrl);
    return http<CurrentUser>("PUT", "/api/me/profile", { body: { ...input, avatarUrl } });
  },

  updatePreferences: (patch) => http<CurrentUser>("PATCH", "/api/me/preferences", { body: patch }),

  getProfile: (username) => http<UserProfile>("GET", user(username)),

  getSuggestions: (limit) =>
    http<UserProfile[]>("GET", "/api/people/suggestions", { query: { limit } }),

  searchPeople: (query, limit) =>
    http<UserProfile[]>("GET", "/api/people/search", { query: { q: query, limit } }),

  follow: (userId) => http<UserProfile>("PUT", `${user(userId)}/follow`),

  unfollow: (userId) => http<UserProfile>("DELETE", `${user(userId)}/follow`),

  getBlockedUsers: () => http<UserProfile[]>("GET", "/api/me/blocked"),

  block: (userId) => http<void>("PUT", `${user(userId)}/block`),

  unblock: (userId) => http<void>("DELETE", `${user(userId)}/block`),

  deleteAccount: () => http<void>("DELETE", "/api/me"),
};
