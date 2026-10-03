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
}
