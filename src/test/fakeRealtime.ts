import { vi } from "vitest";

import {
  realtimeClient,
  type RealtimeEvent,
  type RealtimeEventMap,
  type RealtimeStatus,
} from "@/services/realtime/realtimeClient";

type Handler = (payload: never) => void;

/**
 * Replaces the realtime transport for hook tests (PLAN.md §17): tests emit server events and status changes
 * directly, and see what the app emitted. Restored by vi.restoreAllMocks().
 */
export function fakeRealtime() {
  const handlers = new Map<RealtimeEvent, Set<Handler>>();
  const statusHandlers = new Set<(status: RealtimeStatus) => void>();
  const connect = vi.spyOn(realtimeClient, "connect").mockImplementation(() => {});
  const disconnect = vi.spyOn(realtimeClient, "disconnect").mockImplementation(() => {});
  vi.spyOn(realtimeClient, "getStatus").mockReturnValue("open");
  const emitTyping = vi.spyOn(realtimeClient, "emitTyping").mockReturnValue(true);
  vi.spyOn(realtimeClient, "subscribe").mockImplementation((event, handler) => {
    const set = handlers.get(event) ?? new Set<Handler>();
    set.add(handler as Handler);
    handlers.set(event, set);
    return () => set.delete(handler as Handler);
  });
  vi.spyOn(realtimeClient, "onStatusChange").mockImplementation((handler) => {
    statusHandlers.add(handler);
    return () => statusHandlers.delete(handler);
  });
  return {
    connect,
    disconnect,
    emitTyping,
    emit<K extends RealtimeEvent>(event: K, payload: RealtimeEventMap[K]) {
      handlers
        .get(event)
        ?.forEach((handler) => (handler as (p: RealtimeEventMap[K]) => void)(payload));
    },
    status(status: RealtimeStatus) {
      statusHandlers.forEach((handler) => handler(status));
    },
    subscribers(event: RealtimeEvent) {
      return handlers.get(event)?.size ?? 0;
    },
  };
}
