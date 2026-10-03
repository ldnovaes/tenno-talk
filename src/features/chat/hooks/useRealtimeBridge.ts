import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { realtimeClient } from "@/services/realtime/realtimeClient";
import { usePresenceStore } from "@/stores/presenceStore";

import { setReceipt, setTranslation, upsertMessage } from "../lib/messageCache";
import { chatKeys } from "../lib/queryKeys";

const TYPING_TIMEOUT_MS = 6_000;

/**
 * The only place that turns realtime events into cache/presence updates
 * (PLAN.md §17). Mounted once by the app shell.
 */
export function useRealtimeBridge(viewerId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    realtimeClient.connect({ userId: viewerId });
    const presence = usePresenceStore.getState();
    const typingTimers = new Map<string, number>();

    const stopTyping = (conversationId: string, userId: string) => {
      const key = `${conversationId}:${userId}`;
      window.clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      presence.setTyping(conversationId, userId, false);
    };

    const unsubscribers = [
      realtimeClient.subscribe("message.created", ({ message }) => {
        if (message.senderId !== viewerId) stopTyping(message.conversationId, message.senderId);
        upsertMessage(queryClient, message, { incrementUnread: message.senderId !== viewerId });
      }),
      realtimeClient.subscribe("message.updated", ({ message }) =>
        upsertMessage(queryClient, message),
      ),
      realtimeClient.subscribe(
        "translation.updated",
        ({ conversationId, messageId, translation }) =>
          setTranslation(queryClient, conversationId, messageId, translation),
      ),
      realtimeClient.subscribe("message.delivered", ({ conversationId, upToMessageId }) =>
        setReceipt(queryClient, conversationId, viewerId, upToMessageId, "delivered"),
      ),
      realtimeClient.subscribe("message.read", ({ conversationId, upToMessageId }) =>
        setReceipt(queryClient, conversationId, viewerId, upToMessageId, "read"),
      ),
      realtimeClient.subscribe("typing.started", ({ conversationId, userId }) => {
        const key = `${conversationId}:${userId}`;
        window.clearTimeout(typingTimers.get(key));
        presence.setTyping(conversationId, userId, true);
        typingTimers.set(
          key,
          window.setTimeout(() => stopTyping(conversationId, userId), TYPING_TIMEOUT_MS),
        );
      }),
      realtimeClient.subscribe("typing.stopped", ({ conversationId, userId }) =>
        stopTyping(conversationId, userId),
      ),
      realtimeClient.subscribe("user.online", ({ userId }) => presence.setOnline(userId, true)),
      realtimeClient.subscribe("user.offline", ({ userId, lastSeenAt }) =>
        presence.setOnline(userId, false, lastSeenAt),
      ),
      realtimeClient.onStatusChange((status) => {
        // Live presence is stale while disconnected; the refetched data is the truth again.
        if (status === "reconnecting") usePresenceStore.getState().reset();
        // Recover anything missed while disconnected (PLAN.md §17).
        if (status === "open") void queryClient.invalidateQueries({ queryKey: chatKeys.all });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      typingTimers.forEach((timer) => window.clearTimeout(timer));
      realtimeClient.disconnect();
      usePresenceStore.getState().reset();
    };
  }, [viewerId, queryClient]);
}
