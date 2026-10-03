import type { ISODateString } from "./api";
import type { LanguageCode } from "./language";
import type { MediaAttachment } from "./media";

export type DeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type TranslationStatus = "not_needed" | "pending" | "translating" | "translated" | "failed";

/** Original text as written by its author. Immutable. */
export interface OriginalText {
  text: string;
  language: LanguageCode;
}

/** Translation into ONE target language. A higher version replaces a lower one. */
export interface ContentTranslation {
  targetLanguage: LanguageCode;
  text: string | null;
  status: TranslationStatus;
  version: number;
  updatedAt: ISODateString;
}

export type MessageContent =
  | { type: "text"; body: OriginalText }
  | { type: "image"; media: MediaAttachment[]; caption: OriginalText | null }
  | { type: "video"; media: MediaAttachment; caption: OriginalText | null }
  | { type: "audio"; media: MediaAttachment }
  | { type: "file"; media: MediaAttachment; fileName: string }
  | { type: "story_reply"; storyId: string; body: OriginalText };

export interface MessageReference {
  messageId: string;
  senderId: string;
  /** Already in the viewer's display form. */
  preview: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  /** Client-generated id used to reconcile optimistic sends (idempotency key). */
  clientId: string | null;
  conversationId: string;
  senderId: string;
  content: MessageContent;
  /** Translation into the VIEWER's receiving language (projected by the server). */
  translation: ContentTranslation | null;
  replyTo: MessageReference | null;
  reactions: ReactionSummary[];
  /** Meaningful for the viewer's own messages. */
  deliveryStatus: DeliveryStatus;
  createdAt: ISODateString;
  // No editedAt/deletedAt: editing and deleting are out of scope (PLAN.md §34).
}

/** Learning Mode details, loaded on demand. */
export interface TranslationInsight {
  messageId: string;
  targetLanguage: LanguageCode;
  natural: string;
  literal: string;
  explanation: string | null;
  vocabulary: { term: string; meaning: string; note: string | null }[];
  pronunciation: string | null;
}
