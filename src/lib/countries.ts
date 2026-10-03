import type { CountryCode } from "@/types/language";

export const COUNTRY_CODES: readonly CountryCode[] = [
  "BR",
  "PT",
  "US",
  "GB",
  "CA",
  "ES",
  "MX",
  "AR",
  "VN",
  "FR",
  "DE",
  "IT",
  "JP",
  "KR",
  "CN",
  "TH",
  "IN",
  "RU",
  "EG",
  "SA",
  "AE",
  "AU",
  "NZ",
  "PH",
  "ID",
  "CO",
  "CL",
  "PE",
];

const displayNames = new Map<string, Intl.DisplayNames>();

/** Localized country name via Intl.DisplayNames, falling back to the code. */
export function getCountryName(code: CountryCode, locale = "en"): string {
  try {
    let names = displayNames.get(locale);
    if (!names) {
      names = new Intl.DisplayNames([locale], { type: "region" });
      displayNames.set(locale, names);
    }
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}
