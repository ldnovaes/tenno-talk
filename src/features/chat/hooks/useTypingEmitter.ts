import { useCallback, useEffect, useRef } from "react";

import { realtimeClient } from "@/services/realtime/realtimeClient";

const THROTTLE_MS = 3_000;
const IDLE_MS = 5_000;

/** Emits typing.started (throttled) and typing.stopped after inactivity. */
export function useTypingEmitter(conversationId: string) {
  const lastSent = useRef(0);
  const idleTimer = useRef<number | null>(null);
  const typing = useRef(false);

  const stop = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (typing.current) realtimeClient.emitTyping(conversationId, false);
    typing.current = false;
    lastSent.current = 0;
  }, [conversationId]);

  const onInput = useCallback(() => {
    const now = Date.now();
    if (!typing.current || now - lastSent.current > THROTTLE_MS) {
      realtimeClient.emitTyping(conversationId, true);
      typing.current = true;
      lastSent.current = now;
    }
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(stop, IDLE_MS);
  }, [conversationId, stop]);

  useEffect(() => stop, [stop]);

  return { onInput, stop };
}
