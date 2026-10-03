import type { Language, LanguageCode } from "@/types/language";

/** Supported languages. Native name is primary in the UI (PLAN.md §9.2). */
export const LANGUAGES: readonly Language[] = [
  {
    code: "pt-BR",
    englishName: "Portuguese (Brazil)",
    nativeName: "Português (Brasil)",
    dir: "ltr",
    defaultCountry: "BR",
  },
  {
    code: "pt-PT",
    englishName: "Portuguese (Portugal)",
    nativeName: "Português (Portugal)",
    dir: "ltr",
    defaultCountry: "PT",
  },
  {
    code: "en-US",
    englishName: "English (US)",
    nativeName: "English (US)",
    dir: "ltr",
    defaultCountry: "US",
  },
  {
    code: "en-GB",
    englishName: "English (UK)",
    nativeName: "English (UK)",
    dir: "ltr",
    defaultCountry: "GB",
  },
  {
    code: "es-ES",
    englishName: "Spanish",
    nativeName: "Español",
    dir: "ltr",
    defaultCountry: "ES",
  },
  {
    code: "vi-VN",
    englishName: "Vietnamese",
    nativeName: "Tiếng Việt",
    dir: "ltr",
    defaultCountry: "VN",
  },
  {
    code: "fr-FR",
    englishName: "French",
    nativeName: "Français",
    dir: "ltr",
    defaultCountry: "FR",
  },
  { code: "de-DE", englishName: "German", nativeName: "Deutsch", dir: "ltr", defaultCountry: "DE" },
  {
    code: "it-IT",
    englishName: "Italian",
    nativeName: "Italiano",
    dir: "ltr",
    defaultCountry: "IT",
  },
  {
    code: "ja-JP",
    englishName: "Japanese",
    nativeName: "日本語",
    dir: "ltr",
    defaultCountry: "JP",
  },
  { code: "ko-KR", englishName: "Korean", nativeName: "한국어", dir: "ltr", defaultCountry: "KR" },
  {
    code: "zh-CN",
    englishName: "Chinese (Simplified)",
    nativeName: "简体中文",
    dir: "ltr",
    defaultCountry: "CN",
  },
  { code: "th-TH", englishName: "Thai", nativeName: "ไทย", dir: "ltr", defaultCountry: "TH" },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", dir: "rtl", defaultCountry: null },
  { code: "hi-IN", englishName: "Hindi", nativeName: "हिन्दी", dir: "ltr", defaultCountry: "IN" },
  {
    code: "ru-RU",
    englishName: "Russian",
    nativeName: "Русский",
    dir: "ltr",
    defaultCountry: "RU",
  },
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = "en-US";

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));

export function getLanguage(code: LanguageCode): Language | undefined {
  return BY_CODE.get(code);
}

export function getLanguageDir(code: LanguageCode): "ltr" | "rtl" {
  return BY_CODE.get(code)?.dir ?? "ltr";
}

/** Primary subtag, e.g. "pt" for "pt-BR". */
export function baseLanguage(code: LanguageCode): string {
  return code.split("-")[0]?.toLowerCase() ?? code.toLowerCase();
}

export function isSameLanguage(a: LanguageCode, b: LanguageCode): boolean {
  return baseLanguage(a) === baseLanguage(b);
}

/**
 * Maps the device languages (navigator.languages) to a supported language.
 * Exact match first, then the same base language. PLAN.md §9.2 / §34 (decision 4).
 */
export function detectSystemLanguage(
  systemLanguages: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language],
): LanguageCode {
  for (const tag of systemLanguages) {
    const exact = LANGUAGES.find((language) => language.code.toLowerCase() === tag.toLowerCase());
    if (exact) return exact.code;
    const base = LANGUAGES.find((language) => baseLanguage(language.code) === baseLanguage(tag));
    if (base) return base.code;
  }
  return DEFAULT_LANGUAGE;
}

export function searchLanguages(query: string): Language[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...LANGUAGES];
  return LANGUAGES.filter(
    (language) =>
      language.nativeName.toLowerCase().includes(normalized) ||
      language.englishName.toLowerCase().includes(normalized) ||
      language.code.toLowerCase().startsWith(normalized),
  );
}
