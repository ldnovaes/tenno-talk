import { toAppError } from "@/lib/errors";
import { chatService } from "@/services/chatService";
import { useSessionStore } from "@/stores/sessionStore";

const pending = new Map<string, Set<string>>();
let owner: string | null = null;
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
export function acknowledgeReceived(conversation: string, ids: string[]) {
  const viewer = useSessionStore.getState().userId;
  if (owner !== viewer) {
    pending.clear();
    owner = viewer;
  }
  if (!viewer) return;
  const set = pending.get(conversation) ?? new Set<string>();
  ids.forEach((id) => {
    if (!id.startsWith("tmp_")) set.add(id);
  });
  if (set.size) pending.set(conversation, set);
  void flush();
}
async function flush() {
  if (running) return;
  if (owner !== useSessionStore.getState().userId) {
    pending.clear();
    return;
  }
  running = true;
  try {
    for (const [conversation, ids] of pending) {
      const batch = [...ids].slice(0, 100);
      try {
        if (batch.length) await chatService.acknowledge(conversation, batch);
        batch.forEach((id) => ids.delete(id));
      } catch (error) {
        // Transient: keep everything for the next attempt. Refused (e.g. no longer a member):
        // drop that conversation only; the others still owe their senders a delivered tick.
        if (toAppError(error).retryable) break;
        ids.clear();
      }
      if (!ids.size) pending.delete(conversation);
    }
  } finally {
    running = false;
    if (timer) clearTimeout(timer);
    if (pending.size) timer = setTimeout(() => void flush(), 5000);
  }
}
