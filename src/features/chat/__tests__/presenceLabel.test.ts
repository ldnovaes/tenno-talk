import { describe, expect, it } from "vitest";

import { presenceLabel } from "@/features/chat/lib/presenceLabel";

const now = new Date(2026, 9, 3, 12, 0);
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("presenceLabel (bucket boundaries)", () => {
  it.each([
    ["online wins over last seen", true, ago(5), { kind: "online" }],
    ["online without history", true, null, { kind: "online" }],
    ["offline without history (or hidden by privacy)", false, null, { kind: "unknown" }],
    ["0 min", false, ago(0), { kind: "justNow" }],
    ["59 s", false, new Date(now.getTime() - 59_000).toISOString(), { kind: "justNow" }],
    ["future (clock skew)", false, ago(-5), { kind: "justNow" }],
    ["1 min", false, ago(1), { kind: "minutes", count: 1 }],
    ["59 min", false, ago(59), { kind: "minutes", count: 59 }],
    ["60 min", false, ago(60), { kind: "hours", count: 1 }],
    ["119 min", false, ago(119), { kind: "hours", count: 1 }],
    ["1439 min", false, ago(1439), { kind: "hours", count: 23 }],
  ] as const)("%s", (_name, isOnline, lastSeenAt, expected) => {
    expect(presenceLabel({ isOnline, lastSeenAt }, now)).toEqual(expected);
  });

  it("from one day on, shows the date", () => {
    expect(presenceLabel({ isOnline: false, lastSeenAt: ago(1440) }, now)).toEqual({
      kind: "date",
      date: "2 Oct",
    });
    expect(presenceLabel({ isOnline: false, lastSeenAt: ago(60 * 24 * 40) }, now)).toEqual({
      kind: "date",
      date: "24 Aug",
    });
  });
});
