import type { RealtimeEvent } from "./realtimeClient";

/** Pure helpers of the WebSocket protocol (PLAN.md §26), kept apart for testing. */
const EVENTS: ReadonlySet<string> = new Set<RealtimeEvent>([
  "message.created",
  "message.updated",
  "message.delivered",
  "message.read",
  "translation.updated",
  "reaction.created",
  "reaction.deleted",
  "user.online",
  "user.offline",
  "typing.started",
  "typing.stopped",
  "notification.created",
  "notifications.read",
]);

export type ServerFrame =
  { kind: "event"; type: RealtimeEvent; payload: unknown } | { kind: "pong" } | { kind: "ignored" };

/** Parses `{ type, payload }`; anything unknown or malformed is ignored, never thrown. */
export function parseFrame(data: unknown): ServerFrame {
  if (typeof data !== "string") return { kind: "ignored" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { kind: "ignored" };
  }
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    return { kind: "ignored" };
  }
  const { type } = parsed;
  if (type === "pong") return { kind: "pong" };
  if (typeof type !== "string" || !EVENTS.has(type) || !("payload" in parsed)) {
    return { kind: "ignored" };
  }
  return { kind: "event", type: type as RealtimeEvent, payload: parsed.payload };
}

/** Exponential backoff with "equal jitter": 0.5–1× of min(30s, 1s·2^attempt). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt));
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

/** Same origin as the page: ws:// in development (Vite proxy), wss:// behind Caddy. */
export function socketUrl(location: Pick<Location, "protocol" | "host">): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}
