import type { LanguageCode } from "@/types/language";

import { mockDb } from "./db";
import { publish } from "./events";
import { chance, getMockConfig } from "./latency";
import { translateText } from "./mockTranslator";
import { needsTranslation, originalOf, receivingLanguageOf } from "./projections";
import type { MessageRecord, MockDatabase } from "./schema";

/**
 * Simulates the backend translation worker (PLAN.md §28): pending → translating →
 * translated (v1, literal-ish) → maybe translated (v2, natural), or failed.
 */
function targetsFor(db: MockDatabase, message: MessageRecord): LanguageCode[] {
  const original = originalOf(message.content);
  const conversation = db.conversations[message.conversationId];
  if (!original || !conversation) return [];
  const languages = conversation.memberIds
    .map((id) => receivingLanguageOf(db, id))
    .filter((language): language is LanguageCode => language !== null);
  return [...new Set(languages)].filter((language) => needsTranslation(original, language));
}

function setTranslation(
  messageId: string,
  target: LanguageCode,
  patch: (current: { text: string | null; version: number }) => {
    text: string | null;
    status: "pending" | "translating" | "translated" | "failed";
    version: number;
  },
): void {
  const conversationId = mockDb.update((db) => {
    const message = db.messages[messageId];
    if (!message) return null;
    const current = message.translations[target] ?? { text: null, version: 0 };
    message.translations[target] = {
      targetLanguage: target,
      ...patch(current),
      updatedAt: new Date().toISOString(),
    };
    return message.conversationId;
  });
  if (conversationId) publish({ kind: "translation.updated", conversationId, messageId });
}

function runTranslation(messageId: string, target: LanguageCode, allowFailure: boolean): void {
  const config = getMockConfig();
  setTranslation(messageId, target, (current) => ({
    text: current.text,
    status: "translating",
    version: current.version,
  }));
  setTimeout(() => {
    const message = mockDb.read().messages[messageId];
    const original = message ? originalOf(message.content) : null;
    if (!message || !original) return;
    if (allowFailure && chance(config.translationFailureRate)) {
      setTranslation(messageId, target, (current) => ({
        text: current.text,
        status: "failed",
        version: current.version,
      }));
      return;
    }
    const result = translateText(original.text, original.language, target);
    const improveLater =
      result.literal !== result.natural && chance(config.improvedTranslationRate);
    mockDb.update((db) => {
      const record = db.messages[messageId];
      if (record) record.literals[target] = result.literal;
    });
    setTranslation(messageId, target, (current) => ({
      text: improveLater ? result.literal : result.natural,
      status: "translated",
      version: current.version + 1,
    }));
    if (improveLater) {
      setTimeout(() => {
        setTranslation(messageId, target, (current) => ({
          text: result.natural,
          status: "translated",
          version: current.version + 1,
        }));
      }, config.improvedTranslationDelayMs);
    }
  }, config.translationDelayMs);
}

/** Queues translations for every member language that differs from the original. */
export function scheduleTranslations(messageId: string): void {
  const db = mockDb.read();
  const message = db.messages[messageId];
  if (!message) return;
  for (const target of targetsFor(db, message)) {
    if (message.translations[target]) continue;
    setTranslation(messageId, target, () => ({ text: null, status: "pending", version: 0 }));
    runTranslation(messageId, target, true);
  }
}

/** Manual "Retry translation". */
export function retryTranslation(messageId: string, target: LanguageCode): void {
  runTranslation(messageId, target, false);
}
