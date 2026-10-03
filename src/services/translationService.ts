import { env } from "@/lib/env";
import type { LanguageCode } from "@/types/language";
import type { ContentTranslation, TranslationInsight } from "@/types/message";

import { mockTranslationService } from "./mock/implementations/mockTranslationService";
import { httpTranslationService } from "./http/httpTranslationService";

export type TranslatableContent = { kind: "post" | "comment" | "story"; id: string };

/**
 * The frontend never calls an AI provider: it only asks the backend for states
 * (PLAN.md §14.1). The backend uses ChatGPT, falling back to Claude (§28).
 */
export interface TranslationService {
  retryMessageTranslation(messageId: string): Promise<ContentTranslation>;
  getTranslationInsight(
    messageId: string,
    targetLanguage: LanguageCode,
  ): Promise<TranslationInsight>;
  translateContent(
    content: TranslatableContent,
    targetLanguage: LanguageCode,
  ): Promise<ContentTranslation>;
}

export const translationService: TranslationService =
  env.dataSource === "http" ? httpTranslationService : mockTranslationService;
