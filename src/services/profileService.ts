import type { CountryCode, LanguageCode } from "@/types/language";
import type { UserPreferences } from "@/types/preferences";
import type { CurrentUser, UserProfile } from "@/types/user";

import { mockProfileService } from "./mock/implementations/mockProfileService";
import { httpProfileService } from "./http/httpProfileService";

export interface CompleteOnboardingInput {
  nativeLanguage: LanguageCode;
  receivingLanguage: LanguageCode;
  displayName: string;
  username: string;
  bio: string | null;
  country: CountryCode;
  avatarUrl: string | null;
}

export interface UpdateProfileInput {
  displayName: string;
  username: string;
  bio: string | null;
  country: CountryCode;
  avatarUrl: string | null;
  nativeLanguage: LanguageCode;
  learningLanguages: LanguageCode[];
}

/** Recursive partial used for optimistic preference updates. */
export type PreferencesPatch = {
  [K in keyof UserPreferences]?: UserPreferences[K] extends object
    ? Partial<UserPreferences[K]>
    : UserPreferences[K];
};

export interface ProfileService {
  getMe(): Promise<CurrentUser>;
  acceptTerms(version: string): Promise<CurrentUser>;
  checkUsername(username: string): Promise<{ available: boolean }>;
  completeOnboarding(input: CompleteOnboardingInput): Promise<CurrentUser>;
  updateProfile(input: UpdateProfileInput): Promise<CurrentUser>;
  updatePreferences(patch: PreferencesPatch): Promise<CurrentUser>;
  getProfile(username: string): Promise<UserProfile>;
  getSuggestions(limit: number): Promise<UserProfile[]>;
  searchPeople(query: string, limit: number): Promise<UserProfile[]>;
  follow(userId: string): Promise<UserProfile>;
  unfollow(userId: string): Promise<UserProfile>;
  getFollowRequests(): Promise<UserProfile[]>;
  approveFollowRequest(userId: string): Promise<void>;
  rejectFollowRequest(userId: string): Promise<void>;
  getBlockedUsers(): Promise<UserProfile[]>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  /** LGPD: everything stored about the account, as a JSON document. */
  exportMyData(): Promise<unknown>;
  /** LGPD: removes the account and its personal data. */
  deleteAccount(): Promise<void>;
}

export const profileService: ProfileService = __USE_HTTP__
  ? httpProfileService
  : mockProfileService;
