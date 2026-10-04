import { useCallback, useEffect, useRef } from "react";
import { realtimeClient } from "@/services/realtime/realtimeClient";

const THROTTLE_MS = 3_000;
const IDLE_MS = 5_000;

/** Ephemeral activity: reconnect only renews recent input, never old drafts. */
export function useTypingEmitter(conversationId: string) {
  const lastSent = useRef(0);
  const lastInput = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typing = useRef(false);
  const stop = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (typing.current) realtimeClient.emitTyping(conversationId, false);
    typing.current = false;
    lastInput.current = 0;
    lastSent.current = 0;
  }, [conversationId]);
  const start = useCallback(() => {
    if (realtimeClient.emitTyping(conversationId, true)) {
      typing.current = true;
      lastSent.current = Date.now();
    }
  }, [conversationId]);
  const onInput = useCallback(() => {
    lastInput.current = Date.now();
    if (!typing.current || Date.now() - lastSent.current >= THROTTLE_MS) start();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, IDLE_MS);
  }, [start, stop]);
  useEffect(() => {
    const unsubscribe = realtimeClient.onStatusChange((status) => {
      if (status !== "open") {
        typing.current = false;
        lastSent.current = 0;
      } else if (
        lastInput.current &&
        Date.now() - lastInput.current < IDLE_MS &&
        document.visibilityState !== "hidden"
      )
        start();
    });
    const hide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", hide);
      stop();
    };
  }, [start, stop]);
  return { onInput, stop };
}
