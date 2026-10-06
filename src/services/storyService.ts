import type { Message } from "@/types/message";
import type { Story, StoryTrayItem } from "@/types/story";

import type { MediaInput } from "./chatService";
import { mockStoryService } from "./mock/implementations/mockStoryService";
import { httpStoryService } from "./http/httpStoryService";

export interface StoryService {
  /** People with active stories: the viewer first, then unseen, then seen. */
  getUserStories(userId: string): Promise<Story[]>;
  getStory(storyId: string): Promise<Story>;
  getTray(): Promise<StoryTrayItem[]>;
  markViewed(storyId: string): Promise<void>;
  /** Quick reaction: notifies the author. */
  react(storyId: string, emoji: string): Promise<void>;
  /** Sends a direct message that references the story; returns the conversation id. */
  /** The reply is a direct message: its conversation and the message as the sender sees it. */
  reply(
    storyId: string,
    text: string,
    clientId?: string,
  ): Promise<{ conversationId: string; message: Message }>;
  createStory(input: { media: MediaInput; text: string }): Promise<Story>;
}

export const storyService: StoryService = __USE_HTTP__ ? httpStoryService : mockStoryService;
