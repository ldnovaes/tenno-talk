import type { ConversationRecord, MockDatabase } from "./schema";
import { AppError } from "@/lib/errors";

export function blockedEitherWay(db: MockDatabase, a: string, b: string): boolean {
  return !!db.users[a]?.blockedUserIds.includes(b) || !!db.users[b]?.blockedUserIds.includes(a);
}

/** The recipient's rule applies to every direct message, including old conversations. */
export function canDirectMessage(db: MockDatabase, sender: string, recipient: string): boolean {
  if (blockedEitherWay(db, sender, recipient)) return false;
  const audience = db.users[recipient]?.preferences.privacy.whoCanMessage;
  return (
    audience === "everyone" ||
    (audience === "followers" &&
      db.follows.some((follow) => follow.followerId === recipient && follow.followeeId === sender))
  );
}

export function requireDirectSend(
  db: MockDatabase,
  conversation: ConversationRecord,
  sender: string,
): void {
  if (conversation.kind !== "direct") return;
  const recipient = conversation.memberIds.find((id) => id !== sender);
  if (!recipient || !canDirectMessage(db, sender, recipient))
    throw new AppError("forbidden", "Messaging is unavailable.");
}
