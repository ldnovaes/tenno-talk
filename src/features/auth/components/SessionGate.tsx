import { useEffect, type ReactNode } from "react";

import { authService } from "@/services/authService";
import { useSessionStore } from "@/stores/sessionStore";

import { AppSplash } from "./AppSplash";

/** Resolves the session once at boot before rendering any route. PLAN.md §8.2. */
export function SessionGate({ children }: { children: ReactNode }) {
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

  if (status === "unknown") return <AppSplash />;
  return children;
}
