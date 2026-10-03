import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MediaInput } from "@/services/chatService";
import { storyService } from "@/services/storyService";
import type { StoryTrayItem } from "@/types/story";

import { storyKeys } from "../lib/queryKeys";

export function useStoryTray() {
  return useQuery({ queryKey: storyKeys.tray(), queryFn: () => storyService.getTray() });
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, text }: { storyId: string; text: string }) =>
      storyService.reply(storyId, text),
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
