import { useQuery } from "@tanstack/react-query";

import { translationService } from "@/services/translationService";

import { translationKeys } from "../lib/queryKeys";

/** Learning Mode details, fetched only when the panel opens (PLAN.md §15). */
export function useTranslationInsight(messageId: string | null, language: string | null) {
  return useQuery({
    queryKey: translationKeys.insight(messageId ?? "", language ?? ""),
    queryFn: () => translationService.getTranslationInsight(messageId ?? "", language ?? ""),
    enabled: messageId !== null && language !== null,
    staleTime: Infinity,
  });
}
