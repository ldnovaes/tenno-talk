import { create } from "zustand";

import { readJson, writeJson } from "@/lib/storage";
import type { Session } from "@/services/authService";

const HINT_KEY = "tenno.has-session";

/**
 * Whether this browser was signed in last time. Not a credential (the cookie is): it only lets
 * first-time visitors see the public pages without waiting for the session check.
 */
export function hadSession(): boolean {
  return readJson<boolean>(HINT_KEY) === true;
}

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
  setSession: (session) => {
    writeJson(HINT_KEY, session !== null);
    set(
      session
        ? { status: "authenticated", userId: session.userId }
        : { status: "anonymous", userId: null },
    );
  },
}));
