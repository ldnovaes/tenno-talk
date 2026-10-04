import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { persistSend } from "@/services/outbox/store";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MediaInput } from "@/services/chatService";
import { storyService } from "@/services/storyService";
import type { StoryTrayItem } from "@/types/story";

import { storyKeys } from "../lib/queryKeys";

export function useStoryTray() {
  return useQuery({ queryKey: storyKeys.tray(), queryFn: () => storyService.getTray() });
}

export function useUserStories(userId: string) {
  return useQuery({
    queryKey: storyKeys.user(userId),
    queryFn: () => storyService.getUserStories(userId),
  });
}

export function useStory(storyId: string | null) {
  return useQuery({
    queryKey: storyKeys.item(storyId ?? ""),
    queryFn: () => storyService.getStory(storyId ?? ""),
    enabled: !!storyId,
  });
}

/** Marks a story as seen locally right away so rings update without a refetch. */
export function useMarkStoryViewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => storyService.markViewed(storyId),
    onMutate: (storyId) =>
      queryClient.setQueryData<StoryTrayItem[]>(storyKeys.tray(), (tray) =>
        tray?.map((item) => {
          if (!item.stories.some((story) => story.id === storyId)) return item;
          const stories = item.stories.map((story) =>
            story.id === storyId ? { ...story, viewedByMe: true } : story,
          );
          return { ...item, stories, hasUnseen: stories.some((story) => !story.viewedByMe) };
        }),
      ),
    meta: { silent: true },
  });
}

export function useReactToStory() {
  return useMutation({
    mutationFn: ({ storyId, emoji }: { storyId: string; emoji: string }) =>
      storyService.react(storyId, emoji),
  });
}

export function useReplyToStory() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const pending = useRef<{ text: string; storyId: string; id: string } | null>(null);
  return useMutation({
    mutationFn: async ({ storyId, text }: { storyId: string; text: string }) => {
      if (pending.current?.text !== text || pending.current.storyId !== storyId)
        pending.current = { text, storyId, id: crypto.randomUUID() };
      if (!__USE_HTTP__) {
        const result = await storyService.reply(storyId, text, pending.current.id);
        pending.current = null;
        return { ...result, queued: false };
      }
      const clientId = pending.current.id;
      const conversationId = `story:${storyId}`;
      await persistSend(
        me.id,
        { clientId, conversationId, text, media: [], replyToId: null },
        {
          id: `tmp_${clientId}`,
          clientId,
          conversationId,
          senderId: me.id,
          content: { type: "story_reply", storyId, body: { text, language: me.nativeLanguage } },
          translation: null,
          replyTo: null,
          reactions: [],
          deliveryStatus: "sending",
          createdAt: new Date().toISOString(),
        },
        storyId,
      );
      pending.current = null;
      return { conversationId, queued: true };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] }),
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { media: MediaInput; text: string }) => storyService.createStory(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: storyKeys.tray() }),
  });
}
