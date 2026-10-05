import { describe, expect, it } from "vitest";

import { formatCompact } from "../numbers";

describe("formatCompact", () => {
  it("keeps small numbers and shortens big ones", () => {
    expect(formatCompact(950, "en-US")).toBe("950");
    expect(formatCompact(1_234, "en-US")).toBe("1.2K");
    expect(formatCompact(3_400_000, "en-US")).toBe("3.4M");
  });

  it("follows the interface language", () => {
    expect(formatCompact(1_234, "pt-BR")).toMatch(/1,2\s?mil/);
  });

  it("falls back to plain digits for an invalid locale", () => {
    expect(formatCompact(1_234, "not a locale!")).toBe("1234");
  });
});
