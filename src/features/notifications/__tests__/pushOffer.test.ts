import { describe, expect, it } from "vitest";

import { PUSH_PROMPT_SNOOZE_MS, pushOffer } from "@/features/notifications/lib/pushOffer";
import { needsHomeScreenInstall } from "@/lib/platform";
import { caseName, cartesian } from "@/test/combinations";

const now = 1_000_000_000_000;
const SNOOZES = { never: null, recent: now - 1000, expired: now - PUSH_PROMPT_SNOOZE_MS } as const;

describe("pushOffer (every state combination)", () => {
  const rows = cartesian({
    enabled: [true, false],
    supported: [true, false],
    needsInstall: [true, false],
    permission: ["default", "granted", "denied"] as NotificationPermission[],
    subscribed: [true, false],
    snooze: Object.keys(SNOOZES) as (keyof typeof SNOOZES)[],
  });

  // PLAN.md §36.2: invite only while it can still succeed. Nothing without server keys, on a
  // subscribed device or during the 30-day snooze; on iPhone/iPad tabs explain the Home Screen
  // step; elsewhere ask only if the browser supports push and was never asked.
  function expected(row: (typeof rows)[number]) {
    if (!row.enabled || row.subscribed || row.snooze === "recent") return null;
    if (row.needsInstall) return "install";
    return row.supported && row.permission === "default" ? "ask" : null;
  }

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    expect(
      pushOffer({
        enabled: row.enabled,
        supported: row.supported,
        needsInstall: row.needsInstall,
        permission: row.permission,
        subscribed: row.subscribed,
        dismissedAt: SNOOZES[row.snooze],
        now,
      }),
    ).toBe(expected(row));
  });
});

describe("needsHomeScreenInstall", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
  const ipadMobile = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)";
  // iPadOS 13+ Safari asks for desktop sites by default: a Mac user agent, but a touch screen.
  const ipadDesktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const linux = "Mozilla/5.0 (X11; Linux x86_64) Chrome/140";

  it.each([
    ["iPhone tab", iphone, false, 5, true],
    ["iPhone Home Screen app", iphone, true, 5, false],
    ["iPad tab (mobile site)", ipadMobile, false, 5, true],
    ["iPad tab (desktop site)", ipadDesktop, false, 5, true],
    ["iPad Home Screen app (desktop site)", ipadDesktop, true, 5, false],
    ["Mac without touch", ipadDesktop, false, 0, false],
    ["Linux touch laptop", linux, false, 10, false],
  ] as const)("%s", (_name, userAgent, standalone, touchPoints, expected) => {
    expect(needsHomeScreenInstall(userAgent, standalone, touchPoints)).toBe(expected);
  });
});
