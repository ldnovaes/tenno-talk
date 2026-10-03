import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { isSameLanguage } from "@/lib/languages";
import { translationService, type TranslatableContent } from "@/services/translationService";
import type { ContentTranslation, OriginalText } from "@/types/message";

import { translationKeys } from "../lib/queryKeys";
import { useTranslationPreferences } from "./useTranslationPreferences";

export interface ContentTranslationState {
  /** Original in another language than the viewer's. */
  translatable: boolean;
  showingTranslation: boolean;
  text: string;
  language: string;
  isTranslating: boolean;
  seeTranslation: () => void;
  seeOriginal: () => void;
}

/**
 * Captions, comments and story texts (PLAN.md §14.5): translated automatically
 * when the preference says so, otherwise on "See translation". Never overwrites
 * the original.
 */
export function useContentTranslation(
  content: TranslatableContent,
  original: OriginalText | null,
  existing: ContentTranslation | null,
  autoTranslate: boolean,
): ContentTranslationState {
  const { receivingLanguage } = useTranslationPreferences();
  const [choice, setChoice] = useState<"original" | "translation" | null>(null);
  const translatable =
    original !== null &&
    existing?.status !== "not_needed" &&
    !isSameLanguage(original.language, receivingLanguage);
  const wantsTranslation = translatable && (choice ? choice === "translation" : autoTranslate);
  const ready =
    existing?.status === "translated" && existing.targetLanguage === receivingLanguage
      ? existing
      : null;

  const query = useQuery({
    queryKey: translationKeys.content(content, receivingLanguage),
    queryFn: () => translationService.translateContent(content, receivingLanguage),
    enabled: wantsTranslation && ready === null,
    staleTime: Infinity,
  });

  const translation = ready ?? (query.data?.status === "translated" ? query.data : null);
  const showingTranslation = wantsTranslation && translation?.text != null;

  return {
    translatable,
    showingTranslation,
    text: showingTranslation && translation?.text ? translation.text : (original?.text ?? ""),
    language:
      showingTranslation && translation
        ? translation.targetLanguage
        : (original?.language ?? receivingLanguage),
    isTranslating: wantsTranslation && !showingTranslation && query.isFetching,
    seeTranslation: () => setChoice("translation"),
    seeOriginal: () => setChoice("original"),
  };
}
