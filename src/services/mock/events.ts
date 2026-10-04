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
/** How long an event may wait for this tab to see the data it refers to. */
const CATCH_UP_TIMEOUT_MS = 1_000;

/** On the channel, each event says which database revision it describes. */
interface Envelope {
  event: ServerEvent;
  revision: number;
}

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);

/**
 * Each tab is a separate process and localStorage reaches other processes asynchronously, so an
 * event may arrive before this tab can read its data. Such events wait (in order) until the
 * revision shows up here; handling them early would drop them or write a stale copy back.
 */
const waiting: Envelope[] = [];
let timeout: ReturnType<typeof setTimeout> | null = null;

function deliver(event: ServerEvent) {
  listeners.forEach((listener) => listener(event));
}

function drain(force = false) {
  while (waiting.length > 0) {
    const next = waiting[0];
    if (!next || (!force && mockDb.revision() < next.revision)) break;
    waiting.shift();
    // Another tab changed the database before emitting: refresh our copy first.
    mockDb.reload();
    deliver(next.event);
  }
  if (timeout) clearTimeout(timeout);
  timeout = waiting.length > 0 ? setTimeout(() => drain(true), CATCH_UP_TIMEOUT_MS) : null;
}

channel?.addEventListener("message", (message: MessageEvent<Envelope>) => {
  waiting.push(message.data);
  drain();
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "tenno.mockdb") mockDb.reload();
    if (event.key === mockDb.revisionKey) drain();
  });
}

export function publish(event: ServerEvent): void {
  deliver(event);
  channel?.postMessage({ event, revision: mockDb.revision() } satisfies Envelope);
}

export function onServerEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
