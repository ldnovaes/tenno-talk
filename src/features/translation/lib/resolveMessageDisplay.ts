import type { LanguageCode } from "@/types/language";
import type { ContentTranslation, OriginalText } from "@/types/message";
import type { TranslationDisplayMode } from "@/types/preferences";

export type DisplayOverride = "original" | "translation";

export interface DisplayInput {
  original: OriginalText;
  translation: ContentTranslation | null;
  isOwn: boolean;
  mode: TranslationDisplayMode;
  override: DisplayOverride | null;
}

export interface DisplayPart {
  text: string;
  language: LanguageCode;
  kind: "original" | "translation";
}

export interface DisplayResult {
  primary: DisplayPart;
  /** Only in "Original + Translation": the original under the translation, same bubble. */
  secondary: DisplayPart | null;
  /** Shown when the translation is wanted but not available yet. */
  hint: "translating" | "failed" | null;
  /** Whether "Show original / Show translation" makes sense for this message. */
  canToggle: boolean;
  showing: "original" | "translation";
}

/**
 * Decides what a message shows (PLAN.md §14.3). Pure: the original is never
 * altered; the translation is a representation that can be swapped in or out.
 */
export function resolveMessageDisplay({
  original,
  translation,
  isOwn,
  mode,
  override,
}: DisplayInput): DisplayResult {
  const originalPart: DisplayPart = {
    text: original.text,
    language: original.language,
    kind: "original",
  };
  const translatable = translation !== null && translation.status !== "not_needed";
  const ready = translatable && translation.status === "translated" && translation.text !== null;

  if (!translatable) {
    return {
      primary: originalPart,
      secondary: null,
      hint: null,
      canToggle: false,
      showing: "original",
    };
  }

  // Own messages read in the original by default; "Show translation" reveals what the other side got.
  const wantsTranslation = override ? override === "translation" : !isOwn && mode !== "original";

  if (wantsTranslation && ready && translation.text !== null) {
    const translationPart: DisplayPart = {
      text: translation.text,
      language: translation.targetLanguage,
      kind: "translation",
    };
    const showBoth = mode === "both" && override === null && !isOwn;
    return {
      primary: translationPart,
      secondary: showBoth ? originalPart : null,
      hint: null,
      canToggle: true,
      showing: "translation",
    };
  }

  const hint = wantsTranslation
    ? translation.status === "failed"
      ? "failed"
      : "translating"
    : null;
  return { primary: originalPart, secondary: null, hint, canToggle: true, showing: "original" };
}

const DELAYED_AFTER_MS = 2 * 60_000;

/** A translation waiting for too long (e.g. AI providers re-authenticating, PLAN.md §28.3). */
export function isTranslationDelayed(sinceIso: string, now: Date): boolean {
  return now.getTime() - new Date(sinceIso).getTime() > DELAYED_AFTER_MS;
}
