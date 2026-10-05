import { describe, expect, it } from "vitest";

import { PUSH_PROMPT_SNOOZE_MS, pushOffer } from "@/features/notifications/lib/pushOffer";
import { needsHomeScreenInstall } from "@/lib/platform";

const now = 1_000_000_000_000;
const ready = {
  enabled: true,
  supported: true,
  needsInstall: false,
  permission: "default" as NotificationPermission,
  subscribed: false,
  dismissedAt: null,
  now,
};

describe("pushOffer", () => {
  it("asks while the browser has never been asked", () => {
    expect(pushOffer(ready)).toBe("ask");
  });

  it("stays quiet when asking cannot succeed or is not needed", () => {
    expect(pushOffer({ ...ready, enabled: false })).toBeNull();
    expect(pushOffer({ ...ready, supported: false })).toBeNull();
    expect(pushOffer({ ...ready, subscribed: true })).toBeNull();
    expect(pushOffer({ ...ready, permission: "denied" })).toBeNull();
    expect(pushOffer({ ...ready, permission: "granted" })).toBeNull();
  });

  it("comes back after the snooze", () => {
    expect(pushOffer({ ...ready, dismissedAt: now - 1000 })).toBeNull();
    expect(pushOffer({ ...ready, dismissedAt: now - PUSH_PROMPT_SNOOZE_MS })).toBe("ask");
  });

  it("explains the Home Screen step where push needs it", () => {
    expect(pushOffer({ ...ready, supported: false, needsInstall: true })).toBe("install");
    expect(pushOffer({ ...ready, needsInstall: true, enabled: false })).toBeNull();
  });
});

describe("needsHomeScreenInstall", () => {
  it("applies only to iPhone/iPad browser tabs", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
    expect(needsHomeScreenInstall(iphone, false)).toBe(true);
    expect(needsHomeScreenInstall(iphone, true)).toBe(false);
    expect(needsHomeScreenInstall("Mozilla/5.0 (X11; Linux x86_64) Chrome/140", false)).toBe(false);
  });
});
