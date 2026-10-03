import { describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockAuthService } from "@/services/mock/implementations/mockAuthService";
import { readMockSession } from "@/services/mock/session";

describe("mockAuthService", () => {
  it("has no session by default", async () => {
    expect(await mockAuthService.getSession()).toBeNull();
  });

  it("signs up a new user that still needs onboarding", async () => {
    const session = await mockAuthService.signUp({
      email: " New@Example.com ",
      password: "secret123",
    });
    const user = mockDb.read().users[session.userId];
    expect(user?.email).toBe("new@example.com");
    expect(user?.onboardingCompletedAt).toBeNull();
    expect(user?.termsAcceptedVersion).toBeNull();
    expect(user?.providers).toEqual(["password"]);
    expect(await mockAuthService.getSession()).toEqual(session);
  });

  it("rejects a duplicate email with a field error", async () => {
    await expect(
      mockAuthService.signUp({ email: "lucas@demo.tenno.talk", password: "whatever1" }),
    ).rejects.toMatchObject({ code: "conflict", fieldErrors: { email: expect.any(String) } });
  });

  it("signs in with the right password only", async () => {
    await expect(
      mockAuthService.signInWithPassword({ email: "lucas@demo.tenno.talk", password: "nope" }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    const session = await mockAuthService.signInWithPassword({
      email: "LUCAS@demo.tenno.talk",
      password: "demo1234",
    });
    expect(session.userId).toBe("usr_lucas");
  });

  it("creates a fresh account for each simulated OAuth sign-in", async () => {
    const google = await mockAuthService.startOAuth("google");
    const facebook = await mockAuthService.startOAuth("facebook");
    expect(google.userId).not.toBe(facebook.userId);
    expect(mockDb.read().users[google.userId]?.email).toMatch(/@gmail\.com$/);
    // Facebook may not return an email (PLAN.md R16).
    expect(mockDb.read().users[facebook.userId]?.email).toBeNull();
    expect(mockDb.read().users[facebook.userId]?.providers).toEqual(["facebook"]);
  });

  it("signs in as a demo account", async () => {
    expect(await mockAuthService.signInAsDemo("usr_cam")).toEqual({ userId: "usr_cam" });
    await expect(mockAuthService.signInAsDemo("usr_nobody")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("ignores a session for a user that no longer exists", async () => {
    await mockAuthService.signInAsDemo("usr_cam");
    mockDb.update((db) => {
      delete db.users["usr_cam"];
    });
    expect(await mockAuthService.getSession()).toBeNull();
  });

  it("signs out", async () => {
    await mockAuthService.signInAsDemo("usr_cam");
    await mockAuthService.signOut();
    expect(readMockSession()).toBeNull();
  });
});
