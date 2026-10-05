import { describe, expect, it } from "vitest";

import { isOverlayPath, readBackground } from "@/app/router/overlay";
import {
  ONBOARDING_STEPS,
  SETTINGS_SECTIONS,
  isOnboardingStep,
  isSettingsSection,
  paths,
} from "@/app/router/paths";
import { rememberTarget, takeTarget } from "@/app/router/returnTarget";
import { hidesBottomNav } from "@/layouts/shellRoutes";

/**
 * Every route of AppRoutes (PLAN.md §6.2, §8): whether it opens as an overlay on desktop and
 * whether it takes the whole mobile screen. Full-screen = conversation, settings sections, edit
 * profile, create, notifications and the admin pages (reached from settings, with a back header).
 */
const ROUTES: [path: string, overlay: boolean, hidesNav: boolean][] = [
  ["/chats", false, false],
  ["/chats/conv_1", false, true],
  ["/discover", false, false],
  ["/feed", false, false],
  ["/posts/p1", true, false],
  ["/notifications", false, true],
  ["/create", true, true],
  ["/u/linh", true, false],
  ["/u/linh/edit", true, true],
  ["/settings", true, false],
  ...SETTINGS_SECTIONS.map((section): [string, boolean, boolean] => [
    `/settings/${section}`,
    true,
    true,
  ]),
  ["/admin/ai", false, true],
  ["/admin/reports", false, true],
  ["/stories/usr_linh", true, false],
];

describe.each(ROUTES)("%s", (path, overlay, hidesNav) => {
  it(`overlay on desktop: ${overlay}`, () => expect(isOverlayPath(path)).toBe(overlay));
  it(`full screen on mobile: ${hidesNav}`, () => expect(hidesBottomNav(path)).toBe(hidesNav));
});

describe("paths", () => {
  it("encodes every dynamic segment", () => {
    expect(paths.conversation("a b")).toBe("/chats/a%20b");
    expect(paths.post("p/1")).toBe("/posts/p%2F1");
    expect(paths.post("p1", "c&2")).toBe("/posts/p1?commentId=c%262");
    expect(paths.story("u?1")).toBe("/stories/u%3F1");
    expect(paths.profile("ana maria")).toBe("/u/ana%20maria");
    expect(paths.editProfile("ana#1")).toBe("/u/ana%231/edit");
  });

  it("builds the static and default routes", () => {
    expect(paths.settings()).toBe("/settings");
    expect(paths.onboarding()).toBe("/onboarding/welcome");
    expect(paths.post("p1", "")).toBe("/posts/p1");
  });

  it.each(SETTINGS_SECTIONS)("settings section %s is valid", (section) => {
    expect(isSettingsSection(section)).toBe(true);
    expect(paths.settings(section)).toBe(`/settings/${section}`);
  });

  it.each(ONBOARDING_STEPS)("onboarding step %s is valid", (step) => {
    expect(isOnboardingStep(step)).toBe(true);
  });

  it("rejects unknown sections and steps", () => {
    expect(isSettingsSection("nope")).toBe(false);
    expect(isSettingsSection(undefined)).toBe(false);
    expect(isOnboardingStep("x")).toBe(false);
    expect(isOnboardingStep(undefined)).toBe(false);
  });
});

describe("readBackground", () => {
  it("reads the location under an overlay and ignores anything else", () => {
    const background = { pathname: "/feed", search: "", hash: "", state: null, key: "k" };
    expect(readBackground({ backgroundLocation: background })).toBe(background);
    expect(readBackground(null)).toBeUndefined();
    expect(readBackground("x")).toBeUndefined();
    expect(readBackground({ other: 1 })).toBeUndefined();
  });
});

describe("returnTarget (where sign-in sends you back)", () => {
  it("returns the remembered in-app path once", () => {
    rememberTarget("/chats/c1?messageId=m1#end");
    expect(takeTarget("u1")).toBe("/chats/c1?messageId=m1#end");
    expect(takeTarget("u1")).toBeNull();
  });

  it.each([
    ["protocol-relative", "//evil.example/x"],
    ["absolute URL", "https://evil.example/x"],
    ["relative path", "chats"],
  ])("never remembers a %s target", (_name, target) => {
    rememberTarget(target);
    expect(takeTarget("u1")).toBeNull();
  });

  it.each([
    ["protocol-relative", "//evil.example/x"],
    ["backslash host", "/\\evil.example/x"],
    ["absolute URL", "https://evil.example/x"],
  ])("never follows a %s target planted in storage", (_name, target) => {
    sessionStorage.setItem("tenno.return-to", target);
    expect(takeTarget("u1")).toBeNull();
  });

  it("a push link opened by another account goes to its notifications instead", () => {
    rememberTarget("/chats/c1?pushUser=u2");
    expect(takeTarget("u1")).toBe("/notifications");
  });

  it("a push link opened by its recipient keeps the path, without the marker", () => {
    rememberTarget("/chats/c1?pushUser=u1&messageId=m1");
    expect(takeTarget("u1")).toBe("/chats/c1?messageId=m1");
  });
});
