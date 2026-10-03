import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setTranslation } from "@/features/chat/lib/messageCache";
import { translationService } from "@/services/translationService";
import type { Message, OriginalText } from "@/types/message";

import { resolveMessageDisplay, type DisplayResult } from "../lib/resolveMessageDisplay";
import { useTranslationViewStore } from "../stores/translationViewStore";
import { useTranslationPreferences } from "./useTranslationPreferences";

export interface MessageTranslationState {
  /** Null when the message has no text (e.g. a photo without caption). */
  display: DisplayResult | null;
  showOriginal: () => void;
  showTranslation: () => void;
  reset: () => void;
  retry: () => void;
  isRetrying: boolean;
}

/** Everything a bubble needs about translation (PLAN.md §14.4). */
export function useMessageTranslation(
  message: Message,
  original: OriginalText | null,
  viewerId: string,
): MessageTranslationState {
  const queryClient = useQueryClient();
  const { displayMode } = useTranslationPreferences();
  const override = useTranslationViewStore((state) => state.overrides[message.id] ?? null);
  const setOverride = useTranslationViewStore((state) => state.setOverride);

  const retry = useMutation({
    mutationFn: () => translationService.retryMessageTranslation(message.id),
    onSuccess: (translation) =>
      setTranslation(queryClient, message.conversationId, message.id, translation),
  });

  return {
    display: original
      ? resolveMessageDisplay({
          original,
          translation: message.translation,
          isOwn: message.senderId === viewerId,
          mode: displayMode,
          override,
        })
      : null,
    showOriginal: () => setOverride(message.id, "original"),
    showTranslation: () => setOverride(message.id, "translation"),
    reset: () => setOverride(message.id, null),
    retry: () => retry.mutate(),
    isRetrying: retry.isPending,
  };
}
