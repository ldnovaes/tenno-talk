import { pendingPreview } from "@/services/outbox/preview";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listPending, updatePending } from "@/services/outbox/store";
import { dispatchPending } from "@/services/outbox/dispatch";
import { upsertMessage } from "../lib/messageCache";

export function useOutbox(userId: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (!__USE_HTTP__) return;
    const previews = new Map<string, ReturnType<typeof pendingPreview>>();
    let stopped = false;
    let running = false;
    async function flush() {
      if (running || stopped) return;
      running = true;
      try {
        const pending = await listPending(userId);
        const keys = new Set(pending.map((entry) => entry.key));
        for (const [key, preview] of previews)
          if (!keys.has(key)) {
            preview.release();
            previews.delete(key);
          }
        const waiting = new Set<string>();
        for (const entry of pending) {
          if (stopped) break;
          let preview = previews.get(entry.key);
          if (!preview) {
            preview = pendingPreview(entry);
            previews.set(entry.key, preview);
          }
          upsertMessage(client, {
            ...preview.message,
            deliveryStatus: entry.message.deliveryStatus,
          });
          if (waiting.has(entry.input.conversationId)) continue;
          waiting.add(entry.input.conversationId);
          try {
            const message = await dispatchPending(entry);
            if (!stopped && message) {
              upsertMessage(client, message);
              waiting.delete(entry.input.conversationId);
            }
          } catch {
            /* Persisted failure state is displayed on the next pass. */
          }
        }
      } finally {
        running = false;
      }
    }
    // Session recovery unblocks only authentication failures when the same account returns.
    void listPending(userId)
      .then((items) =>
        Promise.all(
          items
            .filter((e) => !e.blocked || e.failureCode === "unauthenticated")
            .map((e) =>
              updatePending(e.key, (v) => (v ? { ...v, blocked: false, nextAttempt: 0 } : v)),
            ),
        ),
      )
      .then(flush)
      .catch(() => undefined);
    const run = () => {
      void flush().catch(() => undefined);
    };
    const timer = setInterval(run, 2000);
    window.addEventListener("online", run);
    return () => {
      stopped = true;
      previews.forEach((preview) => preview.release());
      clearInterval(timer);
      window.removeEventListener("online", run);
    };
  }, [userId, client]);
}
