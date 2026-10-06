import type { Message } from "@/types/message";
import type { StoryService } from "@/services/storyService";
import type { Story, StoryTrayItem } from "@/types/story";

import { http } from "./httpClient";
import { uploadMedia } from "./media";

const story = (id: string) => `/api/stories/${encodeURIComponent(id)}`;

export const httpStoryService: StoryService = {
  getUserStories: (id) => http<Story[]>("GET", `/api/stories/by-user/${encodeURIComponent(id)}`),
  getStory: (id) => http<Story>("GET", story(id)),
  getTray: () => http<StoryTrayItem[]>("GET", "/api/stories/tray"),

  markViewed: (id) => http<void>("PUT", `${story(id)}/view`),

  react: (id, emoji, clientId = crypto.randomUUID()) =>
    http<{ conversationId: string; message: Message }>("POST", `${story(id)}/reactions`, {
      body: { emoji, clientId },
    }),

  reply: (id, text, clientId = crypto.randomUUID()) =>
    http<{ conversationId: string; message: Message }>("POST", `${story(id)}/replies`, {
      body: { clientId, text },
    }),

  async createStory(input) {
    const [media] = await uploadMedia([input.media]);
    return http<Story>("POST", "/api/stories", { body: { mediaId: media?.id, text: input.text } });
  },
};
