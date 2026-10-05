import type { ISODateString } from "./api";
import type { User } from "./user";

interface NotificationBase {
  id: string;
  actor: User;
  createdAt: ISODateString;
  readAt: ISODateString | null;
}

export type Notification = NotificationBase &
  (
    | { type: "like"; postId: string }
    | { type: "comment"; postId: string; commentId: string }
    | { type: "follow" }
    | { type: "follow_request" }
    | { type: "follow_accepted" }
    | { type: "story_reaction"; storyId: string; emoji: string }
    | { type: "new_message"; conversationId: string; messageId: string }
  );

export type NotificationType = Notification["type"];
