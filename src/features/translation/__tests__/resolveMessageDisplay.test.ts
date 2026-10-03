import { describe, expect, it } from "vitest";

import {
  isTranslationDelayed,
  resolveMessageDisplay,
  type DisplayInput,
} from "@/features/translation/lib/resolveMessageDisplay";
import type { ContentTranslation, TranslationStatus } from "@/types/message";

const original = { text: "Em cũng nhớ anh.", language: "vi-VN" };

function translation(
  status: TranslationStatus,
  text: string | null = "Eu também estava com saudade de você.",
): ContentTranslation {
  return {
    targetLanguage: "pt-BR",
    text,
    status,
    version: status === "translated" ? 1 : 0,
    updatedAt: "",
  };
}

function resolve(partial: Partial<DisplayInput>) {
  return resolveMessageDisplay({
    original,
    translation: translation("translated"),
    isOwn: false,
    mode: "translation",
    override: null,
    ...partial,
  });
}

describe("resolveMessageDisplay", () => {
  it("translation mode shows only the translation", () => {
    const result = resolve({});
    expect(result.primary).toEqual({
      text: "Eu também estava com saudade de você.",
      language: "pt-BR",
      kind: "translation",
    });
    expect(result.secondary).toBeNull();
    expect(result.hint).toBeNull();
    expect(result.canToggle).toBe(true);
    expect(result.showing).toBe("translation");
  });

  it("both mode keeps the original as secondary in the same bubble", () => {
    const result = resolve({ mode: "both" });
    expect(result.primary.kind).toBe("translation");
    expect(result.secondary).toEqual({ text: original.text, language: "vi-VN", kind: "original" });
  });

  it("original mode shows the original but still allows toggling", () => {
    const result = resolve({ mode: "original" });
    expect(result.primary.kind).toBe("original");
    expect(result.hint).toBeNull();
    expect(result.canToggle).toBe(true);
  });

  it("per-message override wins over the global mode", () => {
    expect(resolve({ override: "original" }).primary.kind).toBe("original");
    expect(resolve({ mode: "original", override: "translation" }).primary.kind).toBe("translation");
    // An override shows a single version even in both mode.
    expect(resolve({ mode: "both", override: "translation" }).secondary).toBeNull();
  });

  it("own messages show the original; 'show translation' reveals what the recipient got", () => {
    expect(resolve({ isOwn: true }).primary.kind).toBe("original");
    expect(resolve({ isOwn: true, mode: "both" }).secondary).toBeNull();
    expect(resolve({ isOwn: true, override: "translation" }).primary.kind).toBe("translation");
  });

  it.each(["pending", "translating"] as const)(
    "shows the original with a hint while %s",
    (status) => {
      const result = resolve({ translation: translation(status, null) });
      expect(result.primary.kind).toBe("original");
      expect(result.hint).toBe("translating");
    },
  );

  it("shows the original with a retry hint when it failed", () => {
    const result = resolve({ translation: translation("failed", null) });
    expect(result.primary.kind).toBe("original");
    expect(result.hint).toBe("failed");
  });

  it("does not hint when the user chose the original", () => {
    expect(resolve({ mode: "original", translation: translation("failed", null) }).hint).toBeNull();
    expect(resolve({ isOwn: true, translation: translation("translating", null) }).hint).toBeNull();
  });

  it("same language: original only, nothing to toggle", () => {
    const result = resolve({ translation: { ...translation("not_needed", null), version: 0 } });
    expect(result).toMatchObject({
      secondary: null,
      hint: null,
      canToggle: false,
      showing: "original",
    });
  });

  it("no translation at all (e.g. own message in a group)", () => {
    expect(resolve({ translation: null })).toMatchObject({ canToggle: false, showing: "original" });
  });

  it("never modifies the original", () => {
    const input = { original: { ...original }, translation: translation("translated") };
    resolve(input);
    expect(input.original).toEqual(original);
  });
});

describe("isTranslationDelayed", () => {
  it("is delayed after two minutes", () => {
    const now = new Date("2026-10-03T12:00:00.000Z");
    expect(isTranslationDelayed("2026-10-03T11:59:00.000Z", now)).toBe(false);
    expect(isTranslationDelayed("2026-10-03T11:57:00.000Z", now)).toBe(true);
  });
});
