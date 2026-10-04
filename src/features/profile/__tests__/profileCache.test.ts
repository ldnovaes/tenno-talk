import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { patchProfileInCaches, withFollowing } from "@/features/profile/lib/profileCache";
import type { Page } from "@/types/api";
import type { UserProfile } from "@/types/user";

const profile = (id: string, extra: Partial<UserProfile> = {}): UserProfile => ({
  id,
  username: id,
  displayName: id,
  avatarUrl: null,
  bio: null,
  country: "BR",
  nativeLanguage: "pt-BR",
  learningLanguages: [],
  followersCount: 3,
  followingCount: 0,
  postsCount: 0,
  isFollowing: false,
  isPrivate: false,
  followRequestPending: false,
  isOnline: false,
  lastSeenAt: null,
  ...extra,
});

describe("withFollowing", () => {
  it("toggles and adjusts the counter", () => {
    expect(withFollowing(profile("a"), true)).toMatchObject({
      isFollowing: true,
      followersCount: 4,
    });
    expect(withFollowing(profile("a", { isFollowing: true }), false)).toMatchObject({
      followersCount: 2,
    });
  });

  it("is a no-op when already in that state", () => {
    const p = profile("a", { isFollowing: true });
    expect(withFollowing(p, true)).toBe(p);
  });

  it("never goes negative", () => {
    expect(
      withFollowing(profile("a", { isFollowing: true, followersCount: 0 }), false).followersCount,
    ).toBe(0);
  });
});

describe("patchProfileInCaches", () => {
  it("patches detail, list and infinite caches", () => {
    const client = new QueryClient();
    client.setQueryData(profileKeys.byUsername("a"), profile("a"));
    client.setQueryData(profileKeys.suggestions(6), [profile("a"), profile("b")]);
    client.setQueryData<InfiniteData<Page<UserProfile>>>(["profiles", "discover", "all"], {
      pages: [{ items: [profile("b"), profile("a")], nextCursor: null }],
      pageParams: [null],
    });

    patchProfileInCaches(client, "a", (p) => withFollowing(p, true));

    expect(client.getQueryData<UserProfile>(profileKeys.byUsername("a"))?.isFollowing).toBe(true);
    const list = client.getQueryData<UserProfile[]>(profileKeys.suggestions(6));
    expect(list?.map((p) => p.isFollowing)).toEqual([true, false]);
    const infinite = client.getQueryData<InfiniteData<Page<UserProfile>>>([
      "profiles",
      "discover",
      "all",
    ]);
    expect(infinite?.pages[0]?.items.map((p) => p.isFollowing)).toEqual([false, true]);
  });
});
