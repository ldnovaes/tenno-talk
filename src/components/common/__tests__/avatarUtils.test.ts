import { describe, expect, it } from "vitest";

import { avatarColorFor, initialsOf } from "@/components/common/avatarUtils";

describe("initialsOf", () => {
  it.each([
    ["two names", "Ana Maria Silva", "AS"],
    ["one name", "linh", "L"],
    ["extra spaces", "  Linh   Pham  ", "LP"],
    ["accents", "émile zola", "ÉZ"],
    ["Vietnamese", "Phạm Thị Linh", "PL"],
    ["Arabic", "عمر خالد", "عخ"],
    ["Chinese", "李 小龙", "李小"],
    ["Korean", "김 지수", "김지"],
    ["emoji first", "🌸 Linh", "🌸L"],
    ["emoji only", "🦊", "🦊"],
    ["math letters (outside the BMP)", "𝓐lice 𝓑ob", "𝓐𝓑"],
    ["empty", "", "?"],
    ["blank", "   ", "?"],
  ])("%s: %s → %s", (_name, name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });

  it("never returns half of a surrogate pair", () => {
    for (const name of ["🌸 Linh", "Ana 🦊", "𝓐lice"]) {
      expect(initialsOf(name)).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    }
  });
});

describe("avatarColorFor", () => {
  const ids = Array.from({ length: 200 }, (_, n) => `usr_${n}`);

  it("is stable for the same id and always a palette token", () => {
    for (const id of ids) {
      expect(avatarColorFor(id)).toBe(avatarColorFor(id));
      expect(avatarColorFor(id)).toMatch(/^bg-avatar-[1-7]$/);
    }
    expect(avatarColorFor("")).toMatch(/^bg-avatar-[1-7]$/);
    expect(avatarColorFor("用户_🌸")).toMatch(/^bg-avatar-[1-7]$/);
  });

  it("spreads ids over the whole palette", () => {
    expect(new Set(ids.map(avatarColorFor)).size).toBe(7);
  });
});

describe("initialsOf with composed emoji", () => {
  it.each([
    ["flag", "🇧🇷 Rafael", "🇧🇷R"],
    ["family (ZWJ)", "👨‍👩‍👧 Team", "👨‍👩‍👧T"],
    ["skin tone", "👍🏽 Ok", "👍🏽O"],
  ])("%s keeps the whole emoji", (_name, name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
