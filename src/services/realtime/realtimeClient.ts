import type { Notification } from "@/types/notification";
import type { ContentTranslation, Message } from "@/types/message";

import { mockRealtimeClient } from "./mockRealtimeClient";

/** Typed events pushed by the server (PLAN.md §17). Payloads are already projected for the viewer. */
export interface RealtimeEventMap {
  "message.created": { message: Message };
  "message.updated": { message: Message };
  "message.delivered": { conversationId: string; recipientId: string; upToMessageId: string };
  "message.read": { conversationId: string; readerId: string; upToMessageId: string };
  "translation.updated": {
    conversationId: string;
    messageId: string;
    translation: ContentTranslation;
  };
  "reaction.created": { conversationId: string; messageId: string; userId: string; emoji: string };
  "reaction.deleted": { conversationId: string; messageId: string; userId: string; emoji: string };
  "user.online": { userId: string };
  "user.offline": { userId: string; lastSeenAt: string };
  "typing.started": { conversationId: string; userId: string };
  "typing.stopped": { conversationId: string; userId: string };
  "notification.created": { notification: Notification };
}

export type RealtimeEvent = keyof RealtimeEventMap;
export type RealtimeStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";
export type Unsubscribe = () => void;

export interface RealtimeClient {
  connect(session: { userId: string }): void;
  disconnect(): void;
  getStatus(): RealtimeStatus;
  onStatusChange(handler: (status: RealtimeStatus) => void): Unsubscribe;
  subscribe<K extends RealtimeEvent>(
    event: K,
    handler: (payload: RealtimeEventMap[K]) => void,
  ): Unsubscribe;
  emitTyping(conversationId: string, isTyping: boolean): void;
}

export const realtimeClient: RealtimeClient = mockRealtimeClient;
