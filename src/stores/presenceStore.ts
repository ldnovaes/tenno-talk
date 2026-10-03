import { create } from "zustand";

/** Ephemeral realtime state: who is online and who is typing (PLAN.md §11). */
interface PresenceState {
  online: Record<string, boolean>;
  lastSeen: Record<string, string>;
  /** conversationId → user ids currently typing. */
  typing: Record<string, string[]>;
  setOnline: (userId: string, online: boolean, lastSeenAt?: string) => void;
  setTyping: (conversationId: string, userId: string, typing: boolean) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  online: {},
  lastSeen: {},
  typing: {},
  setOnline: (userId, online, lastSeenAt) =>
    set((state) => ({
      online: { ...state.online, [userId]: online },
      lastSeen: lastSeenAt ? { ...state.lastSeen, [userId]: lastSeenAt } : state.lastSeen,
    })),
  setTyping: (conversationId, userId, typing) =>
    set((state) => {
      const current = state.typing[conversationId] ?? [];
      const next = typing
        ? [...new Set([...current, userId])]
        : current.filter((id) => id !== userId);
      return { typing: { ...state.typing, [conversationId]: next } };
    }),
  reset: () => set({ online: {}, lastSeen: {}, typing: {} }),
}));

const EMPTY: string[] = [];

export function useTypingUsers(conversationId: string): string[] {
  return usePresenceStore((state) => state.typing[conversationId] ?? EMPTY);
}

/** Live presence with a fallback to the value the server sent initially. */
export function usePresence(
  userId: string | undefined,
  initial: { isOnline: boolean; lastSeenAt: string | null },
) {
  const online = usePresenceStore((state) => (userId ? state.online[userId] : undefined));
  const lastSeen = usePresenceStore((state) => (userId ? state.lastSeen[userId] : undefined));
  return {
    isOnline: online ?? initial.isOnline,
    lastSeenAt: lastSeen ?? initial.lastSeenAt,
  };
}
