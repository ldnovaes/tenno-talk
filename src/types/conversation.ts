import type { ISODateString } from "./api";
import type { LanguageCode } from "./language";
import type { Message } from "./message";
import type { User } from "./user";

export interface ConversationMember {
  user: User;
  role: "member" | "admin";
  receivingLanguage: LanguageCode;
  lastReadMessageId: string | null;
  /** Initial presence; live updates come from the realtime client. */
  isOnline: boolean;
  lastSeenAt: ISODateString | null;
}

export interface Conversation {
  id: string;
  kind: "direct" | "group";
  /** Groups only; a direct conversation is titled by the other member. */
  title: string | null;
  avatarUrl: string | null;
  createdBy: string;
  members: ConversationMember[];
  lastMessage: Message | null;
  unreadCount: number;
  mutedUntil: ISODateString | null;
  updatedAt: ISODateString;
  /** Direct conversations only: why the viewer can't send right now (PLAN.md §31.1). */
  sendRestriction: SendRestriction | null;
}

/** `unavailable` covers "they blocked you" and "they accept messages from nobody", so a block is never revealed. */
export type SendRestriction = "you_blocked" | "followers_only" | "unavailable";
