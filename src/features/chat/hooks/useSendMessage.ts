import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { persistSend, updatePending } from "@/services/outbox/store";
import { toast } from "sonner";
import { toAppError } from "@/lib/errors";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { createClientId } from "@/lib/ids";
import { chatService, type MediaInput, type SendMessageInput } from "@/services/chatService";
import type { MediaAttachment } from "@/types/media";
import type { Message, MessageContent, MessageReference } from "@/types/message";

import { patchMessage, removeMessage, upsertMessage } from "../lib/messageCache";
import { failedSends, useComposerStore } from "../stores/composerStore";

function optimisticContent(input: SendMessageInput, language: string): MessageContent {
  const text = input.text.trim();
  const body = text ? { text, language } : null;
  const toMedia = (media: MediaInput, index: number): MediaAttachment => ({
    id: `${input.clientId}_${index}`,
    kind: media.kind,
    url: media.url,
    thumbnailUrl: media.kind === "image" ? media.url : null,
    width: media.width,
    height: media.height,
    durationMs: media.durationMs,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    alt: null,
  });
  const images = input.media.filter((m) => m.kind === "image");
  const video = input.media.find((m) => m.kind === "video");
  const file = input.media.find((m) => m.kind === "file");
  if (images.length > 0) return { type: "image", media: images.map(toMedia), caption: body };
  if (video) return { type: "video", media: toMedia(video, 0), caption: body };
  if (file) return { type: "file", media: toMedia(file, 0), fileName: file.fileName };
  return { type: "text", body: body ?? { text: "", language } };
}

/**
 * Optimistic send (PLAN.md §13.1): the bubble appears immediately as "sending",
 * the server response replaces it by clientId, failures keep the text for retry.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const clearComposer = useComposerStore((state) => state.clear);

  const mutation = useMutation({
    mutationFn: async (input: SendMessageInput & { onQueued?: (() => void) | undefined }) => {
      if (!__USE_HTTP__) return chatService.sendMessage(input);
      return null; // The outbox worker preserves conversation order.
    },
    onMutate: async (input) => {
      const replyTo = useComposerStore.getState().replyTo[conversationId] ?? null;
      const optimistic: Message = {
        id: `tmp_${input.clientId}`,
        clientId: input.clientId,
        conversationId,
        senderId: me.id,
        content: optimisticContent(input, me.nativeLanguage),
        translation: null,
        replyTo: replyTo && replyTo.messageId === input.replyToId ? replyTo : null,
        reactions: [],
        deliveryStatus: "sending",
        createdAt: new Date().toISOString(),
      };
      if (__USE_HTTP__)
        await persistSend(me.id, { ...input, onQueued: undefined } as SendMessageInput, optimistic);
      upsertMessage(queryClient, optimistic);
      if (useComposerStore.getState().drafts[conversationId] === input.text)
        clearComposer(conversationId);
      input.onQueued?.();
      failedSends.delete(input.clientId);
    },
    onSuccess: (message) => {
      if (message) upsertMessage(queryClient, message);
    },
    onError: (error, input) => {
      if (__USE_HTTP__) {
        toast.error(toAppError(error).message);
        return;
      }
      failedSends.set(input.clientId, input);
      patchMessage(
        queryClient,
        conversationId,
        { id: `tmp_${input.clientId}`, clientId: input.clientId },
        (m) => ({
          ...m,
          deliveryStatus: "failed",
        }),
      );
    },
    meta: { silent: true },
  });

  // Stable callbacks: they go into the message actions context, and a new function there would
  // re-render every bubble of the conversation on each mutation state change.
  const { mutate } = mutation;

  const send = useCallback(
    (
      text: string,
      media: MediaInput[],
      replyTo: MessageReference | null,
      onQueued?: (() => void) | undefined,
    ) =>
      mutate({
        conversationId,
        onQueued,
        clientId: createClientId(),
        text,
        media,
        replyToId: replyTo?.messageId ?? null,
      }),
    [mutate, conversationId],
  );

  /** Resends with the same clientId: the server deduplicates (idempotency). */
  const retry = useCallback(
    (clientId: string) => {
      if (__USE_HTTP__) {
        void updatePending(`${me.id}:${clientId}`, (e) =>
          e ? { ...e, blocked: false, nextAttempt: 0, leaseUntil: 0 } : e,
        );
        return;
      }
      const input = failedSends.get(clientId);
      if (!input) return;
      patchMessage(queryClient, conversationId, { id: `tmp_${clientId}`, clientId }, (m) => ({
        ...m,
        deliveryStatus: "sending",
      }));
      mutate(input);
    },
    [mutate, queryClient, conversationId, me.id],
  );

  const discard = useCallback(
    (clientId: string) => {
      if (__USE_HTTP__) void updatePending(`${me.id}:${clientId}`, () => undefined);
      failedSends.delete(clientId);
      removeMessage(queryClient, conversationId, { id: `tmp_${clientId}`, clientId });
    },
    [queryClient, conversationId, me.id],
  );

  return { send, retry, discard };
}
