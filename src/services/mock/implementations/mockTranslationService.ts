import { AppError } from "@/lib/errors";
import type { TranslationService } from "@/services/translationService";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { translateText } from "../mockTranslator";
import { needsTranslation, originalOf, projectMessage, targetLanguageFor } from "../projections";
import { requireViewerId } from "../session";
import { retryTranslation } from "../translationPipeline";

export const mockTranslationService: TranslationService = {
  retryMessageTranslation(messageId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const message = db.messages[messageId];
      const conversation = message ? db.conversations[message.conversationId] : undefined;
      if (!message || !conversation?.memberIds.includes(viewerId)) {
        throw new AppError("not_found", "Message not found.");
      }
      const target = targetLanguageFor(db, message, viewerId);
      if (!target) throw new AppError("validation", "Nothing to translate.");
      retryTranslation(messageId, target);
      const projected = projectMessage(mockDb.read(), message, viewerId).translation;
      if (!projected) throw new AppError("validation", "Nothing to translate.");
      return projected;
    });
  },

  getTranslationInsight(messageId, targetLanguage) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const message = db.messages[messageId];
      const conversation = message ? db.conversations[message.conversationId] : undefined;
      if (!message || !conversation?.memberIds.includes(viewerId)) {
        throw new AppError("not_found", "Message not found.");
      }
      const original = originalOf(message.content);
      if (!original || !needsTranslation(original, targetLanguage)) {
        throw new AppError("validation", "This message does not need a translation.");
      }
      const fallback = translateText(original.text, original.language, targetLanguage);
      const translation = message.translations[targetLanguage];
      return {
        messageId,
        targetLanguage,
        natural: translation?.text ?? fallback.natural,
        literal: message.literals[targetLanguage] ?? fallback.literal,
        explanation: null,
        vocabulary: [],
        pronunciation: null,
      };
    });
  },

  translateContent(content, targetLanguage) {
    return mockRequest(() => {
      requireViewerId();
      const db = mockDb.read();
      const source =
        content.kind === "post"
          ? db.posts[content.id]?.caption
          : content.kind === "comment"
            ? db.comments[content.id]?.body
            : db.stories[content.id]?.overlayText;
      if (!source) throw new AppError("not_found", "Content not found.");
      const now = new Date().toISOString();
      if (!needsTranslation(source, targetLanguage)) {
        return {
          targetLanguage,
          text: null,
          status: "not_needed" as const,
          version: 0,
          updatedAt: now,
        };
      }
      const result = translateText(source.text, source.language, targetLanguage);
      const translation = {
        targetLanguage,
        text: result.natural,
        status: "translated" as const,
        version: 1,
        updatedAt: now,
      };
      mockDb.update((state) => {
        if (content.kind === "post") {
          const post = state.posts[content.id];
          if (post) post.captionTranslations[targetLanguage] = translation;
        } else if (content.kind === "comment") {
          const comment = state.comments[content.id];
          if (comment) comment.translations[targetLanguage] = translation;
        } else {
          const story = state.stories[content.id];
          if (story) story.overlayTranslations[targetLanguage] = translation;
        }
      });
      return translation;
    });
  },
};
