import { isSameLanguage } from "@/lib/languages";
import type { Conversation } from "@/types/conversation";
import type { LanguageCode } from "@/types/language";
import type {
  ContentTranslation,
  DeliveryStatus,
  Message,
  MessageContent,
  OriginalText,
} from "@/types/message";

import { toUser } from "./mappers";
import type {
  ConversationRecord,
  MessageContentRecord,
  MessageRecord,
  MockDatabase,
} from "./schema";
import { conversationRestriction, presenceVisible } from "./privacy";

export function originalOf(content: MessageContentRecord): OriginalText | null {
  switch (content.type) {
    case "text":
    case "story_reply":
      return content.body;
    case "image":
    case "video":
      return content.caption;
    case "file":
      return null;
  }
}

export function receivingLanguageOf(db: MockDatabase, userId: string): LanguageCode | null {
  return db.users[userId]?.preferences.translation.receivingLanguage ?? null;
}

/**
 * Receiving language the user had at `at` (PLAN.md §21): changing it never re-translates the
 * past. Falls back to the current language when the history does not cover `at`.
 */
export function receivingLanguageAt(
  db: MockDatabase,
  userId: string,
  at: string,
): LanguageCode | null {
  let language: LanguageCode | null = null;
  for (const period of db.users[userId]?.receivingLanguageHistory ?? []) {
    if (period.since > at) break;
    language = period.language;
  }
  return language ?? receivingLanguageOf(db, userId);
}

/** Language the viewer should see this message in: the one in effect when it was sent. */
export function targetLanguageFor(
  db: MockDatabase,
  message: MessageRecord,
  viewerId: string,
): LanguageCode | null {
  if (message.senderId !== viewerId) return receivingLanguageAt(db, viewerId, message.createdAt);
  // Own message: show what the other person received (groups have many languages).
  const conversation = db.conversations[message.conversationId];
  if (conversation?.kind === "group") return null;
  const other = conversation?.memberIds.find((id) => id !== viewerId);
  return other ? receivingLanguageAt(db, other, message.createdAt) : null;
}

export function needsTranslation(original: OriginalText, target: LanguageCode): boolean {
  return !isSameLanguage(original.language, target);
}

function projectTranslation(
  message: MessageRecord,
  target: LanguageCode | null,
): ContentTranslation | null {
  const original = originalOf(message.content);
  if (!original || !target) return null;
  if (!needsTranslation(original, target)) {
    return {
      targetLanguage: target,
      text: null,
      status: "not_needed",
      version: 0,
      updatedAt: message.createdAt,
    };
  }
  // Every target gets its entry when the message is sent; none means old data: original only.
  return message.translations[target] ?? null;
}

function createdAtOf(db: MockDatabase, messageId: string | null): string | null {
  if (!messageId) return null;
  return db.messages[messageId]?.createdAt ?? null;
}

function reached(db: MockDatabase, cursor: string | null, message: MessageRecord): boolean {
  const at = createdAtOf(db, cursor);
  return at !== null && at >= message.createdAt;
}

/** Ticks derived from the other members' cursors (PLAN.md §27). */
export function deliveryStatusOf(
  db: MockDatabase,
  message: MessageRecord,
  viewerId: string,
): DeliveryStatus {
  if (message.statusOverride) return message.statusOverride;
  if (message.senderId !== viewerId) return "read";
  const conversation = db.conversations[message.conversationId];
  if (!conversation) return "sent";
  const others = message.receipts
    ? Object.keys(message.receipts)
    : conversation.memberIds.filter((id) => id !== message.senderId);
  if (others.length === 0) return "sent";
  if (others.every((id) => reached(db, conversation.lastReadMessageId[id] ?? null, message)))
    return "read";
  if (
    others.every(
      (id) =>
        (message.receipts
          ? message.receipts[id]
          : reached(db, conversation.lastDeliveredMessageId[id] ?? null, message)) ||
        reached(db, conversation.lastReadMessageId[id] ?? null, message),
    )
  ) {
    return "delivered";
  }
  return "sent";
}

function projectContent(content: MessageContentRecord): MessageContent {
  return structuredClone(content);
}

function previewText(db: MockDatabase, message: MessageRecord, viewerId: string): string {
  const original = originalOf(message.content);
  const target = targetLanguageFor(db, message, viewerId);
  const translation = projectTranslation(message, target);
  if (message.senderId !== viewerId && translation?.status === "translated" && translation.text) {
    return translation.text;
  }
  if (original) return original.text;
  return message.content.type === "file" ? message.content.fileName : "📷";
}

export function projectMessage(
  db: MockDatabase,
  message: MessageRecord,
  viewerId: string,
): Message {
  const replied = message.replyToId ? db.messages[message.replyToId] : undefined;
  const reactions = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const reaction of message.reactions) {
    const entry = reactions.get(reaction.emoji) ?? { count: 0, reactedByMe: false };
    entry.count += 1;
    entry.reactedByMe ||= reaction.userId === viewerId;
    reactions.set(reaction.emoji, entry);
  }
  return {
    id: message.id,
    clientId: message.clientId,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: projectContent(message.content),
    translation: projectTranslation(message, targetLanguageFor(db, message, viewerId)),
    replyTo: replied
      ? {
          messageId: replied.id,
          senderId: replied.senderId,
          preview: previewText(db, replied, viewerId),
        }
      : null,
    reactions: [...reactions.entries()].map(([emoji, value]) => ({ emoji, ...value })),
    deliveryStatus: deliveryStatusOf(db, message, viewerId),
    createdAt: message.createdAt,
  };
}

export function sortedMessages(db: MockDatabase, conversationId: string): MessageRecord[] {
  return Object.values(db.messages)
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt.localeCompare(b.createdAt),
    );
}

export function unreadCountFor(
  db: MockDatabase,
  conversation: ConversationRecord,
  viewerId: string,
): number {
  const lastRead = createdAtOf(db, conversation.lastReadMessageId[viewerId] ?? null);
  return sortedMessages(db, conversation.id).filter(
    (message) =>
      message.senderId !== viewerId && (lastRead === null || message.createdAt > lastRead),
  ).length;
}

export function projectConversation(
  db: MockDatabase,
  conversation: ConversationRecord,
  viewerId: string,
): Conversation {
  const messages = sortedMessages(db, conversation.id);
  const last = messages[messages.length - 1];
  return {
    id: conversation.id,
    kind: conversation.kind,
    title: conversation.title,
    avatarUrl: conversation.avatarUrl,
    createdBy: conversation.createdBy,
    members: conversation.memberIds
      .map((id) => db.users[id])
      .filter((user) => user !== undefined)
      .map((user) => ({
        user: toUser(user),
        role: user.id === conversation.createdBy ? ("admin" as const) : ("member" as const),
        receivingLanguage: user.preferences.translation.receivingLanguage,
        lastReadMessageId: conversation.lastReadMessageId[user.id] ?? null,
        isOnline: presenceVisible(db, viewerId, user.id) && user.isOnline,
        lastSeenAt: presenceVisible(db, viewerId, user.id) ? user.lastSeenAt : null,
      })),
    lastMessage: last ? projectMessage(db, last, viewerId) : null,
    unreadCount: unreadCountFor(db, conversation, viewerId),
    mutedUntil: conversation.mutedUntil[viewerId] ?? null,
    updatedAt: last?.createdAt ?? conversation.updatedAt,
    sendRestriction: conversationRestriction(db, conversation, viewerId),
  };
}
