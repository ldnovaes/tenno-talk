import type { TranslationService } from "@/services/translationService";
import type { ContentTranslation, TranslationInsight } from "@/types/message";

import { http } from "./httpClient";

const message = (id: string) => `/api/messages/${encodeURIComponent(id)}`;

export const httpTranslationService: TranslationService = {
  retryMessageTranslation: (messageId) =>
    http<ContentTranslation>("POST", `${message(messageId)}/translation/retry`),

  getTranslationInsight: (messageId, targetLanguage) =>
    http<TranslationInsight>("GET", `${message(messageId)}/insight`, {
      query: { lang: targetLanguage },
    }),

  translateContent: (content, targetLanguage) =>
    http<ContentTranslation>(
      "POST",
      `/api/translations/${content.kind}/${encodeURIComponent(content.id)}`,
      { query: { lang: targetLanguage } },
    ),
};
