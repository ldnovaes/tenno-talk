import { describe, expect, it } from "vitest";

import {
  baseLanguage,
  detectSystemLanguage,
  getLanguage,
  getLanguageDir,
  isSameLanguage,
  LANGUAGES,
  searchLanguages,
} from "@/lib/languages";

describe("detectSystemLanguage", () => {
  it("matches an exact tag", () => {
    expect(detectSystemLanguage(["vi-VN"])).toBe("vi-VN");
  });

  it("is case-insensitive", () => {
    expect(detectSystemLanguage(["PT-br"])).toBe("pt-BR");
  });

  it("falls back to the base language", () => {
    expect(detectSystemLanguage(["vi"])).toBe("vi-VN");
    expect(detectSystemLanguage(["es-MX"])).toBe("es-ES");
  });

  it("uses the first supported language in order of preference", () => {
    expect(detectSystemLanguage(["xx-YY", "fr-CA", "en-US"])).toBe("fr-FR");
  });

  it("falls back to English", () => {
    expect(detectSystemLanguage(["xx"])).toBe("en-US");
    expect(detectSystemLanguage([])).toBe("en-US");
  });
});

describe("language catalog", () => {
  it("has unique codes", () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
  });

  it("exposes native names and direction", () => {
    expect(getLanguage("vi-VN")?.nativeName).toBe("Tiếng Việt");
    expect(getLanguageDir("ar")).toBe("rtl");
    expect(getLanguageDir("unknown")).toBe("ltr");
  });

  it("compares base languages", () => {
    expect(baseLanguage("pt-BR")).toBe("pt");
    expect(isSameLanguage("pt-BR", "pt-PT")).toBe(true);
    expect(isSameLanguage("pt-BR", "vi-VN")).toBe(false);
  });

  it("searches by native name, English name and code", () => {
    expect(searchLanguages("viet").map((l) => l.code)).toEqual(["vi-VN"]);
    expect(searchLanguages("tiếng").map((l) => l.code)).toEqual(["vi-VN"]);
    expect(searchLanguages("pt").map((l) => l.code)).toEqual(["pt-BR", "pt-PT"]);
    expect(searchLanguages("  ")).toHaveLength(LANGUAGES.length);
  });
});
