import type { NotificationType } from "@/types/notification";
import type { NotificationPreferences } from "@/types/preferences";

import type { MockDatabase, NotificationRecord } from "./schema";

const PREFERENCE: Record<NotificationType, keyof NotificationPreferences> = {
  like: "likes",
  comment: "comments",
  follow: "followers",
  follow_request: "followers",
  follow_accepted: "followers",
  story_reaction: "likes",
  new_message: "messages",
};

type NotificationTarget = Partial<
  Pick<NotificationRecord, "postId" | "commentId" | "storyId" | "emoji" | "conversationId">
>;

/**
 * Mirrors the server's NotificationService.notify: never to yourself, and only when the
 * recipient wants that type. Returns the new notification id (or null when skipped).
 */
export function addNotification(
  db: MockDatabase,
  recipientId: string,
  actorId: string,
  type: NotificationType,
  target: NotificationTarget = {},
): string | null {
  if (recipientId === actorId) return null;
  const recipient = db.users[recipientId];
  if (!recipient?.preferences.notifications[PREFERENCE[type]]) return null;
  const id = `ntf_${crypto.randomUUID()}`;
  db.notifications[id] = {
    id,
    recipientId,
    actorId,
    type,
    postId: null,
    commentId: null,
    storyId: null,
    emoji: null,
    conversationId: null,
    messageId: null,
    ...target,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  return id;
}

/** Mirrors NotificationService.retract: drops notifications that no longer apply. */
export function retractNotifications(
  db: MockDatabase,
  recipientId: string,
  type: NotificationType,
  actorId?: string,
): boolean {
  let removed = false;
  for (const record of Object.values(db.notifications)) {
    if (
      record.recipientId === recipientId &&
      record.type === type &&
      (actorId === undefined || record.actorId === actorId)
    ) {
      delete db.notifications[record.id];
      removed = true;
    }
  }
  return removed;
}
