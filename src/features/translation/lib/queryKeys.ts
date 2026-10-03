import type { TranslatableContent } from "@/services/translationService";

export const translationKeys = {
  insight: (messageId: string, language: string) =>
    ["translation", "insight", messageId, language] as const,
  content: (content: TranslatableContent, language: string) =>
    ["translation", "content", content.kind, content.id, language] as const,
};
