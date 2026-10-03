import { describe, expect, it } from "vitest";

import { groupNotifications } from "@/features/notifications/lib/groupNotifications";
import type { Notification } from "@/types/notification";

const now = new Date(2026, 9, 3, 15, 0);
const ago = (days: number, id: string): Notification => ({
  id,
  type: "follow",
  actor: { id: "a", username: "a", displayName: "A", avatarUrl: null },
  createdAt: new Date(now.getTime() - days * 86_400_000).toISOString(),
  readAt: null,
});

describe("groupNotifications", () => {
  it("splits into today, this week and earlier keeping order", () => {
    const groups = groupNotifications(
      [ago(0, "n1"), ago(0.1, "n2"), ago(2, "n3"), ago(10, "n4")],
      now,
    );
    expect(groups.map((g) => [g.period, g.items.map((n) => n.id)])).toEqual([
      ["today", ["n1", "n2"]],
      ["thisWeek", ["n3"]],
      ["earlier", ["n4"]],
    ]);
  });

  it("omits empty periods", () => {
    expect(groupNotifications([ago(10, "n1")], now).map((g) => g.period)).toEqual(["earlier"]);
    expect(groupNotifications([], now)).toEqual([]);
  });
});
