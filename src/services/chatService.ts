import type { Page } from "@/types/api";
import type { Conversation } from "@/types/conversation";
import type { MediaKind } from "@/types/media";
import type { Message } from "@/types/message";

import { mockChatService } from "./mock/implementations/mockChatService";
import { httpChatService } from "./http/httpChatService";

/** Media prepared on the client before sending (uploaded to the backend in Phase 8). */
export interface MediaInput {
  kind: Extract<MediaKind, "image" | "video" | "file">;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fileName: string;
}

export interface SendMessageInput {
  conversationId: string;
  /** Client-generated idempotency key; retries reuse it (PLAN.md §13). */
  clientId: string;
  text: string;
  media: MediaInput[];
  replyToId: string | null;
}

export interface ChatService {
  getConversations(): Promise<Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation>;
  /** Newest page first; items inside a page are in chronological order. */
  getMessages(conversationId: string, cursor: string | null): Promise<Page<Message>>;
  sendMessage(input: SendMessageInput): Promise<Message>;
  acknowledge(conversationId: string, messageIds: string[]): Promise<void>;
  markAsRead(conversationId: string, messageId: string): Promise<void>;
  /** Toggles the viewer's reaction. */
  react(messageId: string, emoji: string): Promise<Message>;
  forward(messageId: string, conversationIds: string[]): Promise<void>;
  setMuted(conversationId: string, muted: boolean): Promise<Conversation>;
  getOrCreateDirectConversation(userId: string): Promise<Conversation>;
  createGroup(input: { title: string; memberIds: string[] }): Promise<Conversation>;
}

export const chatService: ChatService = __USE_HTTP__ ? httpChatService : mockChatService;
