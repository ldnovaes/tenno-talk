import { describe, expect, it } from "vitest";

import { dayKey, dayLabel, formatListTimestamp, minutesSince } from "@/lib/dates";

const now = new Date(2026, 9, 3, 15, 30);

function at(daysAgo: number, hour = 9, minute = 42) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

describe("formatListTimestamp", () => {
  const labels = { yesterday: "Yesterday" };
  it("shows time today", () => expect(formatListTimestamp(at(0), now, labels)).toBe("09:42"));
  it("shows Yesterday", () => expect(formatListTimestamp(at(1), now, labels)).toBe("Yesterday"));
  it("shows weekday within a week", () =>
    expect(formatListTimestamp(at(3), now, labels)).toMatch(/^[A-Z][a-z]{2}$/));
  it("shows day/month this year", () =>
    expect(formatListTimestamp(at(20), now, labels)).toBe("13/09"));
  it("shows full date in other years", () =>
    expect(formatListTimestamp(at(400), now, labels)).toMatch(/^\d{2}\/\d{2}\/2025$/));
});

describe("dayLabel", () => {
  it("labels today and yesterday", () => {
    expect(dayLabel(at(0), now)).toEqual({ kind: "today" });
    expect(dayLabel(at(1), now)).toEqual({ kind: "yesterday" });
  });
  it("labels older days with a date", () => {
    expect(dayLabel(at(5), now)).toEqual({ kind: "date", date: "28 September" });
  });
});

describe("helpers", () => {
  it("builds day keys", () => expect(dayKey(at(0))).toBe("2026-10-03"));
  it("counts minutes", () => {
    expect(minutesSince(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe(5);
    expect(minutesSince(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(0);
  });
});
