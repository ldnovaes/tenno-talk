import { describe, expect, it } from "vitest";

import {
  isTranslationDelayed,
  resolveMessageDisplay,
  type DisplayOverride,
  type DisplayResult,
} from "@/features/translation/lib/resolveMessageDisplay";
import type { ContentTranslation, TranslationStatus } from "@/types/message";
import type { TranslationDisplayMode } from "@/types/preferences";
import { caseName, cartesian } from "@/test/combinations";

const original = { text: "Em cũng nhớ anh.", language: "vi-VN" } as const;
const TRANSLATED_TEXT = "Eu também estava com saudade de você.";

const MODES: TranslationDisplayMode[] = ["translation", "both", "original"];
const OVERRIDES: (DisplayOverride | null)[] = [null, "original", "translation"];
/** `missing` = no translation record at all (e.g. own message in a group). */
const STATUSES: (TranslationStatus | "missing" | "translated_without_text")[] = [
  "missing",
  "not_needed",
  "pending",
  "translating",
  "translated",
  "translated_without_text",
  "failed",
];

function translationFor(status: (typeof STATUSES)[number]): ContentTranslation | null {
  if (status === "missing") return null;
  const ready = status === "translated";
  return {
    targetLanguage: "pt-BR",
    text: ready ? TRANSLATED_TEXT : null,
    status: status === "translated_without_text" ? "translated" : status,
    version: ready ? 1 : 0,
    updatedAt: "",
  };
}

/**
 * The contract table of PLAN.md §14.3, written independently of the implementation:
 * - nothing to translate (no record, same language) → original only, nothing to toggle;
 * - the reader wants the translation when the override says so, otherwise when the message is not
 *   theirs and the mode is not "original";
 * - wanted and ready → translation first, the original under it only in "both" without override;
 * - wanted but not ready → original with a hint (failed → retry, anything else → shimmer);
 * - not wanted → original, no hint.
 */
function expected(
  mode: TranslationDisplayMode,
  override: DisplayOverride | null,
  own: boolean,
  status: (typeof STATUSES)[number],
): DisplayResult {
  const originalPart = { ...original, kind: "original" as const };
  if (status === "missing" || status === "not_needed") {
    return {
      primary: originalPart,
      secondary: null,
      hint: null,
      canToggle: false,
      showing: "original",
    };
  }
  const wanted = override !== null ? override === "translation" : !own && mode !== "original";
  if (wanted && status === "translated") {
    return {
      primary: { text: TRANSLATED_TEXT, language: "pt-BR", kind: "translation" },
      secondary: mode === "both" && override === null && !own ? originalPart : null,
      hint: null,
      canToggle: true,
      showing: "translation",
    };
  }
  return {
    primary: originalPart,
    secondary: null,
    hint: wanted ? (status === "failed" ? "failed" : "translating") : null,
    canToggle: true,
    showing: "original",
  };
}

describe("resolveMessageDisplay (every mode × override × own × status)", () => {
  const rows = cartesian({
    mode: MODES,
    override: OVERRIDES,
    own: [false, true],
    status: STATUSES,
  });

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    const result = resolveMessageDisplay({
      original,
      translation: translationFor(row.status),
      isOwn: row.own,
      mode: row.mode,
      override: row.override,
    });
    expect(result).toEqual(expected(row.mode, row.override, row.own, row.status));
  });

  it("covers the whole product", () => {
    expect(rows).toHaveLength(MODES.length * OVERRIDES.length * 2 * STATUSES.length);
  });

  it("never modifies the original or the translation", () => {
    const translation = translationFor("translated");
    const frozenOriginal = Object.freeze({ ...original });
    const frozen = translation && Object.freeze({ ...translation });
    resolveMessageDisplay({
      original: frozenOriginal,
      translation: frozen,
      isOwn: false,
      mode: "both",
      override: null,
    });
    expect(frozenOriginal).toEqual(original);
    expect(frozen).toEqual(translation);
  });
});

describe("isTranslationDelayed", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");

  it.each([
    ["just now", "2026-10-03T12:00:00.000Z", false],
    ["1 minute", "2026-10-03T11:59:00.000Z", false],
    ["exactly 2 minutes", "2026-10-03T11:58:00.000Z", false],
    ["2 minutes and 1 ms", "2026-10-03T11:57:59.999Z", true],
    ["3 minutes", "2026-10-03T11:57:00.000Z", true],
    ["in the future (clock skew)", "2026-10-03T12:05:00.000Z", false],
  ])("%s → %s", (_name, since, delayed) => {
    expect(isTranslationDelayed(since, now)).toBe(delayed);
  });
});
