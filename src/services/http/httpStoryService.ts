import type { StoryService } from "@/services/storyService";
import type { Story, StoryTrayItem } from "@/types/story";

import { http } from "./httpClient";
import { uploadMedia } from "./media";

const story = (id: string) => `/api/stories/${encodeURIComponent(id)}`;

export const httpStoryService: StoryService = {
  getTray: () => http<StoryTrayItem[]>("GET", "/api/stories/tray"),

  markViewed: (id) => http<void>("PUT", `${story(id)}/view`),

  react: (id, emoji) => http<void>("POST", `${story(id)}/reactions`, { body: { emoji } }),

  reply: (id, text) =>
    http<{ conversationId: string }>("POST", `${story(id)}/replies`, {
      body: { clientId: crypto.randomUUID(), text },
    }),

  async createStory(input) {
    const [media] = await uploadMedia([input.media]);
    return http<Story>("POST", "/api/stories", { body: { mediaId: media?.id, text: input.text } });
  },
};
