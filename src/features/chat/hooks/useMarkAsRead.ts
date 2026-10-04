import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { chatService } from "@/services/chatService";
import type { Message } from "@/types/message";

import { setConversationUnread } from "../lib/messageCache";

/**
 * Marks the conversation as read when the newest message from someone else is
 * on screen (debounced). Zeroes the unread badge optimistically.
 */
export function useMarkAsRead(
  conversationId: string,
  messages: readonly Message[],
  viewerId: string,
  isAtBottom: boolean,
) {
  const queryClient = useQueryClient();
  const lastMarked = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: (messageId: string) => chatService.markAsRead(conversationId, messageId),
    onSuccess: () => setConversationUnread(queryClient, conversationId, 0),
    onError: () => {
      lastMarked.current = null;
      void queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    retry: 2,
    meta: { silent: true },
  });
  const { mutate } = mutation;

  const lastIncoming = [...messages]
    .reverse()
    .find((m) => m.senderId !== viewerId && !m.id.startsWith("tmp_"));

  useEffect(() => {
    if (!lastIncoming || !isAtBottom || lastMarked.current === lastIncoming.id) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      lastMarked.current = lastIncoming.id;
      mutate(lastIncoming.id);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [lastIncoming, isAtBottom, conversationId, queryClient, mutate]);
}
