import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";

import { authService } from "@/services/authService";
import { paths } from "@/app/router/paths";
import { hadSession, useSessionStore } from "@/stores/sessionStore";

import { AppSplash } from "./AppSplash";

const PUBLIC_ENTRIES: readonly string[] = [paths.welcome(), paths.signIn(), paths.signUp()];

/**
 * Resolves the session once at boot before rendering any route (PLAN.md §8.2). Visitors who were
 * never signed in here see the public pages at once; if the check finds a session after all,
 * RedirectIfAuthed sends them home.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const status = useSessionStore((state) => state.status);
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    if (status !== "unknown") return;
    let cancelled = false;
    authService
      .getSession()
      .then((session) => !cancelled && setSession(session))
      .catch(() => !cancelled && setSession(null));
    return () => {
      cancelled = true;
    };
  }, [status, setSession]);

  if (status === "unknown" && (hadSession() || !PUBLIC_ENTRIES.includes(pathname))) {
    return <AppSplash />;
  }
  return children;
}
