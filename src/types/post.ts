import type { ISODateString } from "./api";
import type { MediaAttachment } from "./media";
import type { ContentTranslation, OriginalText } from "./message";
import type { User } from "./user";

export interface Post {
  id: string;
  author: User;
  media: MediaAttachment[];
  caption: OriginalText | null;
  captionTranslation: ContentTranslation | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: ISODateString;
}

export interface Comment {
  id: string;
  postId: string;
  author: User;
  body: OriginalText;
  translation: ContentTranslation | null;
  createdAt: ISODateString;
}
