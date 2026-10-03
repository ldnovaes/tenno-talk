import { beforeEach, describe, expect, it } from "vitest";

import { env } from "@/lib/env";
import { mockDb } from "@/services/mock/db";
import { mockAuthService } from "@/services/mock/implementations/mockAuthService";
import { mockProfileService } from "@/services/mock/implementations/mockProfileService";
import { clearMockSession, writeMockSession } from "@/services/mock/session";

const onboardingInput = {
  nativeLanguage: "pt-BR",
  receivingLanguage: "pt-BR",
  displayName: "  Maria Silva ",
  username: "@Maria_s",
  bio: "  ",
  country: "BR",
  avatarUrl: null,
};

describe("mockProfileService", () => {
  beforeEach(() => writeMockSession("usr_lucas"));

  it("requires a session", async () => {
    clearMockSession();
    await expect(mockProfileService.getMe()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("returns the current user with account data", async () => {
    const me = await mockProfileService.getMe();
    expect(me).toMatchObject({ id: "usr_lucas", username: "lucas", role: "admin" });
    expect(me.preferences.translation.receivingLanguage).toBe("pt-BR");
    expect(me.followersCount).toBe(2);
    expect(me.followingCount).toBe(2);
  });

  describe("onboarding", () => {
    beforeEach(async () => {
      await mockAuthService.signUp({ email: "maria@example.com", password: "secret123" });
    });

    it("refuses to complete before the terms are accepted", async () => {
      await expect(mockProfileService.completeOnboarding(onboardingInput)).rejects.toMatchObject({
        code: "validation",
      });
    });

    it("completes after accepting the terms and normalizes fields", async () => {
      const accepted = await mockProfileService.acceptTerms(env.termsVersion);
      expect(accepted.termsAcceptedVersion).toBe(env.termsVersion);
      const me = await mockProfileService.completeOnboarding(onboardingInput);
      expect(me).toMatchObject({
        displayName: "Maria Silva",
        username: "maria_s",
        bio: null,
        country: "BR",
      });
      expect(me.onboardingCompletedAt).not.toBeNull();
      expect(me.preferences.translation.receivingLanguage).toBe("pt-BR");
    });

    it("keeps a different receiving language", async () => {
      await mockProfileService.acceptTerms(env.termsVersion);
      const me = await mockProfileService.completeOnboarding({
        ...onboardingInput,
        receivingLanguage: "en-US",
      });
      expect(me.nativeLanguage).toBe("pt-BR");
      expect(me.preferences.translation.receivingLanguage).toBe("en-US");
    });

    it("rejects a taken username", async () => {
      await mockProfileService.acceptTerms(env.termsVersion);
      await expect(
        mockProfileService.completeOnboarding({ ...onboardingInput, username: "cam" }),
      ).rejects.toMatchObject({ code: "conflict", fieldErrors: { username: "taken" } });
    });

    it("rejects an invalid username", async () => {
      await mockProfileService.acceptTerms(env.termsVersion);
      await expect(
        mockProfileService.completeOnboarding({ ...onboardingInput, username: "1abc" }),
      ).rejects.toMatchObject({ code: "validation", fieldErrors: { username: "format" } });
    });
  });

  it("checks username availability", async () => {
    expect(await mockProfileService.checkUsername("cam")).toEqual({ available: false });
    expect(await mockProfileService.checkUsername("lucas")).toEqual({ available: true });
    expect(await mockProfileService.checkUsername("brand_new")).toEqual({ available: true });
    expect(await mockProfileService.checkUsername("x")).toEqual({ available: false });
  });

  it("merges preference patches", async () => {
    const me = await mockProfileService.updatePreferences({ translation: { displayMode: "both" } });
    expect(me.preferences.translation.displayMode).toBe("both");
    expect(me.preferences.translation.receivingLanguage).toBe("pt-BR");
    expect(me.preferences.privacy.whoCanMessage).toBe("everyone");
  });

  it("follows and unfollows idempotently", async () => {
    const before = await mockProfileService.getProfile("emma");
    expect(before.isFollowing).toBe(false);
    await mockProfileService.follow("usr_emma");
    const after = await mockProfileService.follow("usr_emma");
    expect(after.isFollowing).toBe(true);
    expect(after.followersCount).toBe(before.followersCount + 1);
    const undone = await mockProfileService.unfollow("usr_emma");
    expect(undone).toMatchObject({ isFollowing: false, followersCount: before.followersCount });
  });

  it("does not follow yourself", async () => {
    await expect(mockProfileService.follow("usr_lucas")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("returns not_found for unknown or unfinished profiles", async () => {
    await expect(mockProfileService.getProfile("ghost")).rejects.toMatchObject({
      code: "not_found",
    });
    const { userId } = await mockAuthService.signUp({ email: "x@y.com", password: "secret123" });
    writeMockSession("usr_lucas");
    mockDb.update((db) => {
      const user = db.users[userId];
      if (user) user.username = "half_done";
    });
    await expect(mockProfileService.getProfile("half_done")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("suggests other onboarded people, online first, excluding blocked users", async () => {
    mockDb.update((db) => {
      db.users["usr_lucas"]?.blockedUserIds.push("usr_cam");
    });
    const suggestions = await mockProfileService.getSuggestions(20);
    const ids = suggestions.map((p) => p.id);
    expect(ids).not.toContain("usr_lucas");
    expect(ids).not.toContain("usr_cam");
    expect(suggestions[0]?.isOnline).toBe(true);
  });

  it("lists and unblocks blocked users", async () => {
    mockDb.update((db) => {
      db.users["usr_lucas"]?.blockedUserIds.push("usr_omar");
    });
    expect((await mockProfileService.getBlockedUsers()).map((p) => p.id)).toEqual(["usr_omar"]);
    await mockProfileService.unblock("usr_omar");
    expect(await mockProfileService.getBlockedUsers()).toEqual([]);
  });

  it("updates the profile", async () => {
    const me = await mockProfileService.updateProfile({
      displayName: "Lucas A.",
      username: "lucas.a",
      bio: "Hi",
      country: "PT",
      avatarUrl: null,
      nativeLanguage: "pt-BR",
      learningLanguages: ["vi-VN"],
    });
    expect(me).toMatchObject({ displayName: "Lucas A.", username: "lucas.a", country: "PT" });
  });
});
