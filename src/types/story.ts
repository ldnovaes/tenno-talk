import type { ISODateString } from "./api";
import type { MediaAttachment } from "./media";
import type { ContentTranslation, OriginalText } from "./message";
import type { User } from "./user";

export interface Story {
  id: string;
  author: User;
  media: MediaAttachment;
  overlayText: OriginalText | null;
  overlayTranslation: ContentTranslation | null;
  createdAt: ISODateString;
  expiresAt: ISODateString;
  viewedByMe: boolean;
}

export interface StoryTrayItem {
  user: User;
  stories: Story[];
  hasUnseen: boolean;
}
