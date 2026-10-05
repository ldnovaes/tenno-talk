import type { ConversationRecord, MockDatabase } from "./schema";
import type { SendRestriction } from "@/types/conversation";
import type { BlockStatus } from "@/types/user";
import { AppError } from "@/lib/errors";

/** Same rules as the backend (PLAN.md §31.1); privacyMatrix.test.ts runs the cases of PrivacyMatrixIT. */

export function blockedEitherWay(db: MockDatabase, a: string, b: string): boolean {
  return !!db.users[a]?.blockedUserIds.includes(b) || !!db.users[b]?.blockedUserIds.includes(a);
}

function follows(db: MockDatabase, follower: string, followee: string): boolean {
  return db.follows.some((f) => f.followerId === follower && f.followeeId === followee);
}

function requested(db: MockDatabase, follower: string, followee: string): boolean {
  return db.followRequests.some((r) => r.followerId === follower && r.followeeId === followee);
}

export function blockStatus(db: MockDatabase, viewer: string, owner: string): BlockStatus {
  if (db.users[viewer]?.blockedUserIds.includes(owner)) return "blocked_by_me";
  if (db.users[owner]?.blockedUserIds.includes(viewer)) return "blocked_me";
  return "none";
}

/**
 * Why the sender can't message the recipient directly, or null. "People I follow" also accepts someone the
 * recipient asked to follow: the pending request already shows the recipient's interest.
 */
export function directRestriction(
  db: MockDatabase,
  sender: string,
  recipient: string,
): SendRestriction | null {
  if (db.users[sender]?.blockedUserIds.includes(recipient)) return "you_blocked";
  const audience = db.users[recipient]?.preferences.privacy.whoCanMessage;
  if (db.users[recipient]?.blockedUserIds.includes(sender) || audience === "nobody")
    return "unavailable";
  if (
    audience === "followers" &&
    !follows(db, recipient, sender) &&
    !requested(db, recipient, sender)
  )
    return "followers_only";
  return null;
}

/** The recipient's rule applies to every direct message, including old conversations. */
export function canDirectMessage(db: MockDatabase, sender: string, recipient: string): boolean {
  return directRestriction(db, sender, recipient) === null;
}

const RESTRICTION_MESSAGES: Record<SendRestriction, string> = {
  you_blocked: "You blocked this person.",
  followers_only: "This person only accepts messages from people they follow.",
  unavailable: "Messaging is unavailable.",
};

export function requireCanMessage(db: MockDatabase, sender: string, recipient: string): void {
  const restriction = directRestriction(db, sender, recipient);
  if (restriction) throw new AppError("forbidden", RESTRICTION_MESSAGES[restriction]);
}

export function requireDirectSend(
  db: MockDatabase,
  conversation: ConversationRecord,
  sender: string,
): void {
  if (conversation.kind !== "direct") return;
  const recipient = conversation.memberIds.find((id) => id !== sender);
  if (!recipient) throw new AppError("forbidden", RESTRICTION_MESSAGES.unavailable);
  requireCanMessage(db, sender, recipient);
}

export function conversationRestriction(
  db: MockDatabase,
  conversation: ConversationRecord,
  viewer: string,
): SendRestriction | null {
  if (conversation.kind !== "direct") return null;
  const other = conversation.memberIds.find((id) => id !== viewer);
  return other ? directRestriction(db, viewer, other) : null;
}

/** "Who can see when I'm online": everyone, people the owner follows, or nobody; never across a block. */
export function presenceVisible(db: MockDatabase, viewer: string, owner: string): boolean {
  if (viewer === owner) return true;
  if (blockedEitherWay(db, viewer, owner)) return false;
  const audience = db.users[owner]?.preferences.privacy.whoCanSeeOnline;
  return audience === "everyone" || (audience === "followers" && follows(db, owner, viewer));
}
