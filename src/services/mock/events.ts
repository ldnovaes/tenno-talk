import { mockDb } from "./db";

/**
 * Viewer-agnostic facts emitted by the mock backend. Each tab projects them for
 * its own signed-in user (see mockRealtimeClient), like a real server would per socket.
 */
export type ServerEvent =
  | { kind: "message.created"; conversationId: string; messageId: string }
  | { kind: "message.updated"; conversationId: string; messageId: string }
  | { kind: "translation.updated"; conversationId: string; messageId: string }
  | {
      kind: "reaction";
      conversationId: string;
      messageId: string;
      userId: string;
      emoji: string;
      added: boolean;
    }
  | {
      kind: "receipt";
      conversationId: string;
      userId: string;
      receipt: "delivered" | "read";
      upToMessageId: string;
    }
  | { kind: "typing"; conversationId: string; userId: string; isTyping: boolean }
  | { kind: "presence"; userId: string; online: boolean; at: string }
  | { kind: "notification.created"; notificationId: string; recipientId: string };

type Listener = (event: ServerEvent) => void;

const listeners = new Set<Listener>();
const CHANNEL = "tenno-mock-server";

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);

channel?.addEventListener("message", (message: MessageEvent<ServerEvent>) => {
  // Another tab changed the database before emitting: refresh our copy first.
  mockDb.reload();
  listeners.forEach((listener) => listener(message.data));
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "tenno.mockdb") mockDb.reload();
  });
}

export function publish(event: ServerEvent): void {
  listeners.forEach((listener) => listener(event));
  channel?.postMessage(event);
}

export function onServerEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
