import type { Notification } from "@/types/notification";

import { toUser } from "./mappers";
import type { MockDatabase, NotificationRecord } from "./schema";

export function projectNotification(
  db: MockDatabase,
  record: NotificationRecord,
): Notification | null {
  const actor = db.users[record.actorId];
  if (!actor) return null;
  const base = {
    id: record.id,
    actor: toUser(actor),
    createdAt: record.createdAt,
    readAt: record.readAt,
  };
  switch (record.type) {
    case "like":
      return record.postId ? { ...base, type: "like", postId: record.postId } : null;
    case "comment":
      return record.postId && record.commentId
        ? { ...base, type: "comment", postId: record.postId, commentId: record.commentId }
        : null;
    case "follow":
      return { ...base, type: "follow" };
    case "story_reaction":
      return record.storyId && record.emoji
        ? { ...base, type: "story_reaction", storyId: record.storyId, emoji: record.emoji }
        : null;
    case "new_message":
      return record.conversationId
        ? {
            ...base,
            type: "new_message",
            conversationId: record.conversationId,
            messageId: record.messageId ?? "",
          }
        : null;
  }
}
