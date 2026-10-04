import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import type { Page } from "@/types/api";
import type { UserProfile } from "@/types/user";

type ProfileCacheEntry = UserProfile | UserProfile[] | InfiniteData<Page<UserProfile>> | undefined;

function isInfinite(value: unknown): value is InfiniteData<Page<UserProfile>> {
  return typeof value === "object" && value !== null && "pages" in value;
}

function patchOne(profile: UserProfile, userId: string, patch: (p: UserProfile) => UserProfile) {
  return profile.id === userId ? patch(profile) : profile;
}

/** Applies a patch to a profile wherever it is cached (detail, lists, infinite lists). */
export function patchProfileInCaches(
  queryClient: QueryClient,
  userId: string,
  patch: (profile: UserProfile) => UserProfile,
): void {
  queryClient.setQueriesData<ProfileCacheEntry>({ queryKey: profileKeys.all }, (entry) => {
    if (!entry) return entry;
    if (Array.isArray(entry)) return entry.map((p) => patchOne(p, userId, patch));
    if (isInfinite(entry)) {
      return {
        ...entry,
        pages: entry.pages.map((page) => ({
          ...page,
          items: page.items.map((p) => patchOne(p, userId, patch)),
        })),
      };
    }
    if ("id" in entry && "username" in entry) return patchOne(entry, userId, patch);
    return entry;
  });
}

export function withFollowing(profile: UserProfile, following: boolean): UserProfile {
  if (following && (profile.isFollowing || profile.followRequestPending)) return profile;
  if (!following && !profile.isFollowing && !profile.followRequestPending) return profile;
  if (following && profile.isPrivate) return { ...profile, followRequestPending: true };
  if (!following && profile.followRequestPending)
    return { ...profile, followRequestPending: false };
  return {
    ...profile,
    isFollowing: following,
    followRequestPending: false,
    followersCount: Math.max(0, profile.followersCount + (following ? 1 : -1)),
  };
}
