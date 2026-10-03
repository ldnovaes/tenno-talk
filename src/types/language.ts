/** BCP-47 tag, e.g. "pt-BR", "vi-VN". */
export type LanguageCode = string;
/** ISO 3166-1 alpha-2, e.g. "BR", "VN". */
export type CountryCode = string;

export interface Language {
  code: LanguageCode;
  englishName: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  /** Used only for an optional flag next to the language (a flag is not a language). */
  defaultCountry: CountryCode | null;
}
