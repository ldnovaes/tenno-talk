import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/router/paths";
import { chatService } from "@/services/chatService";
import type { Conversation } from "@/types/conversation";
import type { Message, ReactionSummary } from "@/types/message";

import { patchMessage, upsertMessage } from "../lib/messageCache";
import { chatKeys } from "../lib/queryKeys";

export function toggleReaction(reactions: ReactionSummary[], emoji: string): ReactionSummary[] {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, reactedByMe: true }];
  if (existing.reactedByMe) {
    return existing.count <= 1
      ? reactions.filter((reaction) => reaction.emoji !== emoji)
      : reactions.map((reaction) =>
          reaction.emoji === emoji
            ? { ...reaction, count: reaction.count - 1, reactedByMe: false }
            : reaction,
        );
  }
  return reactions.map((reaction) =>
    reaction.emoji === emoji
      ? { ...reaction, count: reaction.count + 1, reactedByMe: true }
      : reaction,
  );
}

export function useReactToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ message, emoji }: { message: Message; emoji: string }) =>
      chatService.react(message.id, emoji),
    onMutate: ({ message, emoji }) =>
      patchMessage(queryClient, message.conversationId, message, (m) => ({
        ...m,
        reactions: toggleReaction(m.reactions, emoji),
      })),
    onSuccess: (message) => upsertMessage(queryClient, message),
    onError: (_error, { message }) =>
      patchMessage(queryClient, message.conversationId, message, () => message),
  });
}

export function useForwardMessage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      messageId,
      conversationIds,
    }: {
      messageId: string;
      conversationIds: string[];
    }) => chatService.forward(messageId, conversationIds),
    onSuccess: (_result, { conversationIds }) => {
      toast.success(t("chat.forward.done", { count: conversationIds.length }));
      void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useMuteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, muted }: { conversationId: string; muted: boolean }) =>
      chatService.setMuted(conversationId, muted),
    onSuccess: (conversation) =>
      queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
        list?.map((item) =>
          item.id === conversation.id ? { ...item, mutedUntil: conversation.mutedUntil } : item,
        ),
      ),
  });
}

/** Opens (or creates) the direct conversation with someone and navigates to it. */
export function useStartConversation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (userId: string) => chatService.getOrCreateDirectConversation(userId),
    onSuccess: (conversation) => {
      queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
        list && !list.some((item) => item.id === conversation.id) ? [conversation, ...list] : list,
      );
      navigate(paths.conversation(conversation.id));
    },
  });
}
