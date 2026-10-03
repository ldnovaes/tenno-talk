import type { CountryCode, LanguageCode } from "@/types/language";
import type { UserPreferences } from "@/types/preferences";
import type { CurrentUser, UserProfile } from "@/types/user";

import { mockProfileService } from "./mock/implementations/mockProfileService";

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
  follow(userId: string): Promise<UserProfile>;
  unfollow(userId: string): Promise<UserProfile>;
  getBlockedUsers(): Promise<UserProfile[]>;
  unblock(userId: string): Promise<void>;
}

export const profileService: ProfileService = mockProfileService;
