import { onServerEvent, publish } from "./events";

/**
 * Which users are signed in on an open tab right now (heartbeats over BroadcastChannel).
 * The auto-responder never answers for a user that a human is driving in another tab.
 */
const lastHeartbeat = new Map<string, number>();
const ACTIVE_WINDOW_MS = 15_000;

onServerEvent((event) => {
  if (event.kind !== "presence") return;
  if (event.online) lastHeartbeat.set(event.userId, Date.parse(event.at));
  else lastHeartbeat.delete(event.userId);
});

export function isUserActive(userId: string, now = Date.now()): boolean {
  const last = lastHeartbeat.get(userId);
  return last !== undefined && now - last < ACTIVE_WINDOW_MS;
}

export function announcePresence(userId: string, online: boolean): void {
  publish({ kind: "presence", userId, online, at: new Date().toISOString() });
}

export function resetPresence(): void {
  lastHeartbeat.clear();
}
