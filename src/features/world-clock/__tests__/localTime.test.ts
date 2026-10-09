import { describe, expect, it } from "vitest";

import { dayPeriod, getLocalTime } from "../lib/localTime";

describe("dayPeriod", () => {
  it.each([
    [0, "night"],
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "night"],
    [23, "night"],
  ] as const)("hour %i is %s", (hour, period) => {
    expect(dayPeriod(hour)).toBe(period);
  });
});

describe("getLocalTime", () => {
  // 2026-10-09 13:05 UTC: 10:05 in São Paulo, 20:05 in Ho Chi Minh City.
  const now = new Date("2026-10-09T13:05:00Z");

  it("formats the time in each zone with a 24-hour clock", () => {
    expect(getLocalTime(now, "America/Sao_Paulo", "en")).toMatchObject({
      time: "10:05",
      period: "morning",
    });
    expect(getLocalTime(now, "Asia/Ho_Chi_Minh", "en")).toMatchObject({
      time: "20:05",
      period: "night",
    });
  });

  it("uses the local date of the zone, not of the viewer", () => {
    const lateUtc = new Date("2026-10-09T23:30:00Z");
    expect(getLocalTime(lateUtc, "America/Sao_Paulo", "en").date).toBe("Fri, Oct 9");
    expect(getLocalTime(lateUtc, "Asia/Ho_Chi_Minh", "en").date).toBe("Sat, Oct 10");
  });

  it("never shows 24:00 at midnight", () => {
    expect(getLocalTime(new Date("2026-10-09T03:00:00Z"), "America/Sao_Paulo", "en").time).toBe(
      "00:00",
    );
  });
});
