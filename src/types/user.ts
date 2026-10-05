import type { ISODateString } from "./api";
import type { CountryCode, LanguageCode } from "./language";
import type { UserPreferences } from "./preferences";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface UserProfile extends User {
  bio: string | null;
  country: CountryCode;
  nativeLanguage: LanguageCode;
  learningLanguages: LanguageCode[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isPrivate: boolean;
  followRequestPending: boolean;
  isOnline: boolean;
  lastSeenAt: ISODateString | null;
  /** A block between the viewer and this person (PLAN.md §31.1). */
  blockStatus: BlockStatus;
}

export type BlockStatus = "none" | "blocked_by_me" | "blocked_me";

export type UserRole = "user" | "admin";
export type AuthProvider = "google" | "facebook" | "password";

export interface CurrentUser extends UserProfile {
  email: string | null;
  role: UserRole;
  connectedProviders: AuthProvider[];
  termsAcceptedVersion: string | null;
  onboardingCompletedAt: ISODateString | null;
  preferences: UserPreferences;
}
