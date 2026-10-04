import { baseLanguage } from "@/lib/languages";

import { mockDb } from "./db";
import { publish } from "./events";
import { getMockConfig } from "./latency";
import { PHRASES } from "./phrasebook";
import { isUserActive } from "./presence";
import { canDirectMessage } from "./privacy";
import type { MessageRecord } from "./schema";
import { scheduleTranslations } from "./translationPipeline";

/** Reply scripts per base language (PLAN.md §16.3). */
const REPLIES: Record<string, string[]> = {
  vi: ["ar_vi_1", "ar_vi_2", "ar_vi_3", "ar_vi_4"],
  es: ["ar_es_1", "ar_es_2"],
  en: ["ar_en_1", "ar_en_2"],
  pt: ["ar_pt_1", "ar_pt_2"],
  ja: ["ar_ja_1"],
  ar: ["ar_ar_1"],
  ko: ["ar_ko_1"],
};

function setCursor(
  conversationId: string,
  userId: string,
  messageId: string,
  receipt: "delivered" | "read",
) {
  mockDb.update((db) => {
    const conversation = db.conversations[conversationId];
    if (!conversation) return;
    conversation.lastDeliveredMessageId[userId] = messageId;
    if (receipt === "read") conversation.lastReadMessageId[userId] = messageId;
  });
  publish({ kind: "receipt", conversationId, userId, receipt, upToMessageId: messageId });
}

function reply(conversationId: string, botId: string): void {
  const created = mockDb.update((db) => {
    const bot = db.users[botId];
    const conversation = db.conversations[conversationId];
    if (!bot || !conversation) return null;
    const recipient = conversation.memberIds.find((id) => id !== botId);
    if (!recipient || !canDirectMessage(db, botId, recipient)) return null;
    const script = REPLIES[baseLanguage(bot.nativeLanguage)] ?? REPLIES["en"] ?? [];
    const sent = Object.values(db.messages).filter(
      (m) => m.conversationId === conversationId && m.senderId === botId,
    ).length;
    const phraseId = script[sent % script.length];
    const phrase = PHRASES.find((p) => p.id === phraseId);
    const text = phrase?.text[bot.nativeLanguage] ?? Object.values(phrase?.text ?? {})[0] ?? "👍";
    const now = new Date().toISOString();
    const message: MessageRecord = {
      id: `msg_${crypto.randomUUID()}`,
      clientId: null,
      conversationId,
      senderId: botId,
      content: { type: "text", body: { text, language: bot.nativeLanguage } },
      translations: {},
      literals: {},
      replyToId: null,
      reactions: [],
      statusOverride: null,
      createdAt: now,
    };
    db.messages[message.id] = message;
    conversation.updatedAt = now;
    conversation.lastReadMessageId[botId] = message.id;
    conversation.lastDeliveredMessageId[botId] = message.id;
    return message;
  });
  if (!created) return;
  publish({ kind: "typing", conversationId, userId: botId, isTyping: false });
  publish({ kind: "message.created", conversationId, messageId: created.id });
  scheduleTranslations(created.id);
}

/**
 * Simulated contacts: delivered → read (if online) → typing → reply. Never answers
 * for a user that is signed in on another open tab (two-person demo).
 */
export function maybeAutoRespond(message: MessageRecord): void {
  const config = getMockConfig();
  if (!config.autoReply) return;
  const db = mockDb.read();
  const conversation = db.conversations[message.conversationId];
  if (!conversation || conversation.kind !== "direct") return;
  const botId = conversation.memberIds.find((id) => id !== message.senderId);
  const bot = botId ? db.users[botId] : undefined;
  if (!botId || !bot || isUserActive(botId)) return;
  if (!canDirectMessage(db, message.senderId, botId)) return;

  const step = config.autoReplyDelayMs;
  setTimeout(() => {
    if (canDirectMessage(mockDb.read(), message.senderId, botId))
      setCursor(conversation.id, botId, message.id, "delivered");
  }, step * 0.8);
  if (!bot.isOnline) return;
  setTimeout(() => {
    if (canDirectMessage(mockDb.read(), message.senderId, botId))
      setCursor(conversation.id, botId, message.id, "read");
  }, step * 1.8);
  setTimeout(() => {
    if (canDirectMessage(mockDb.read(), botId, message.senderId))
      publish({ kind: "typing", conversationId: conversation.id, userId: botId, isTyping: true });
  }, step * 2.4);
  setTimeout(() => reply(conversation.id, botId), step * 4.5);
}
