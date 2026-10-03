import type { Story, StoryTrayItem } from "@/types/story";

import type { MediaInput } from "./chatService";
import { mockStoryService } from "./mock/implementations/mockStoryService";

export interface StoryService {
  /** People with active stories: the viewer first, then unseen, then seen. */
  getTray(): Promise<StoryTrayItem[]>;
  markViewed(storyId: string): Promise<void>;
  /** Quick reaction: notifies the author. */
  react(storyId: string, emoji: string): Promise<void>;
  /** Sends a direct message that references the story; returns the conversation id. */
  reply(storyId: string, text: string): Promise<{ conversationId: string }>;
  createStory(input: { media: MediaInput; text: string }): Promise<Story>;
}

export const storyService: StoryService = mockStoryService;
