import { create } from "zustand";

import type { Session } from "@/services/authService";

export type SessionStatus = "unknown" | "authenticated" | "anonymous";

/** Auth status for guards and transports. Profile data lives in the `me` query. PLAN.md §11. */
interface SessionState {
  status: SessionStatus;
  userId: string | null;
  setSession: (session: Session | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: "unknown",
  userId: null,
  setSession: (session) =>
    set(
      session
        ? { status: "authenticated", userId: session.userId }
        : { status: "anonymous", userId: null },
    ),
}));
