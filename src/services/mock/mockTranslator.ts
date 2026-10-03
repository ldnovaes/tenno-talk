import { baseLanguage } from "@/lib/languages";
import type { LanguageCode } from "@/types/language";

import { PHRASES, type Phrase } from "./phrasebook";

export interface MockTranslation {
  natural: string;
  literal: string;
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?¡¿。！？]+$/u, "");
}

function pick(record: Partial<Record<LanguageCode, string>> | undefined, target: LanguageCode) {
  if (!record) return undefined;
  const exact = record[target];
  if (exact) return exact;
  const base = baseLanguage(target);
  const sibling = Object.entries(record).find(([code]) => baseLanguage(code) === base);
  return sibling?.[1];
}

function findPhrase(text: string, source: LanguageCode): Phrase | undefined {
  const key = normalize(text);
  const inSource = PHRASES.find((phrase) => {
    const value = pick(phrase.text, source);
    return value !== undefined && normalize(value) === key;
  });
  return (
    inSource ??
    PHRASES.find((phrase) =>
      Object.values(phrase.text).some((value) => value !== undefined && normalize(value) === key),
    )
  );
}

/**
 * Phrasebook lookup; unknown sentences get a visibly-marked pseudo translation,
 * so it is obvious that the mock is in use (PLAN.md §16.3).
 */
export function translateText(
  text: string,
  source: LanguageCode,
  target: LanguageCode,
): MockTranslation {
  const phrase = findPhrase(text, source);
  const natural = pick(phrase?.text, target);
  if (natural) return { natural, literal: pick(phrase?.literal, target) ?? natural };
  const pseudo = `«${baseLanguage(target)}» ${text}`;
  return { natural: pseudo, literal: pseudo };
}
