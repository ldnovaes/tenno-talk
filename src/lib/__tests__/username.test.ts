import { describe, expect, it } from "vitest";

import { normalizeUsername, validateUsername } from "@/lib/username";

describe("username rules", () => {
  it("normalizes @, case and spaces", () => {
    expect(normalizeUsername("  @Cam_Nguyen ")).toBe("cam_nguyen");
  });

  it.each([
    ["ab", "length"],
    ["a".repeat(21), "length"],
    ["1abc", "format"],
    ["ab-c", "format"],
    ["ab..c", "dots"],
    ["abc.", "dots"],
    ["admin", "reserved"],
  ])("rejects %s (%s)", (value, problem) => {
    expect(validateUsername(value)).toBe(problem);
  });

  it.each(["cam", "lucas.a", "mai_92", "Abc"])("accepts %s", (value) => {
    expect(validateUsername(value)).toBeNull();
  });
});
