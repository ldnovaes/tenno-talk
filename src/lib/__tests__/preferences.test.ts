import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, mergePreferences } from "@/lib/preferences";
import type { PreferencesPatch } from "@/types/preferences";
import { caseName, cartesian } from "@/test/combinations";

/** One change per group, so each subset of groups in a patch is checked against the rest. */
const CHANGES = {
  interfaceLanguage: "pt-BR",
  translation: { displayMode: "both" },
  privacy: { whoCanMessage: "nobody" },
  notifications: { likes: false },
} as const satisfies PreferencesPatch;
type Group = keyof typeof CHANGES;
const GROUPS = Object.keys(CHANGES) as Group[];

describe("mergePreferences (every subset of groups in a patch)", () => {
  const rows = cartesian(Object.fromEntries(GROUPS.map((group) => [group, [false, true]])));

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    const patch: PreferencesPatch = {};
    for (const group of GROUPS) if (row[group]) Object.assign(patch, { [group]: CHANGES[group] });
    const merged = mergePreferences(DEFAULT_PREFERENCES, patch);

    expect(merged.interfaceLanguage).toBe(row["interfaceLanguage"] ? "pt-BR" : "en-US");
    expect(merged.translation).toEqual({
      ...DEFAULT_PREFERENCES.translation,
      ...(row["translation"] ? CHANGES.translation : {}),
    });
    expect(merged.privacy).toEqual({
      ...DEFAULT_PREFERENCES.privacy,
      ...(row["privacy"] ? CHANGES.privacy : {}),
    });
    expect(merged.notifications).toEqual({
      ...DEFAULT_PREFERENCES.notifications,
      ...(row["notifications"] ? CHANGES.notifications : {}),
    });
  });

  it("never mutates the current preferences", () => {
    const current = structuredClone(DEFAULT_PREFERENCES);
    mergePreferences(current, { privacy: { profileVisibility: "private" } });
    expect(current).toEqual(DEFAULT_PREFERENCES);
  });

  it("an explicit false or 'nobody' is a change, not an absent key", () => {
    const merged = mergePreferences(DEFAULT_PREFERENCES, {
      translation: { autoTranslatePosts: false },
      privacy: { whoCanSeeOnline: "nobody" },
    });
    expect(merged.translation.autoTranslatePosts).toBe(false);
    expect(merged.privacy.whoCanSeeOnline).toBe("nobody");
  });
});
