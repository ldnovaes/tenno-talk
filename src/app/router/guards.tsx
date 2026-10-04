import { useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { ErrorState } from "@/components/common/ErrorState";
import { AppSplash } from "@/features/auth/components/AppSplash";
import { useMe } from "@/features/auth/hooks/useMe";
import { useSessionStore } from "@/stores/sessionStore";

import { AuthenticatedRealtime } from "./AuthenticatedRealtime";

import { paths } from "./paths";
import { rememberTarget } from "./returnTarget";

/** UX only: the server is the source of authorization (PLAN.md §31). */
export function RequireAuth() {
  const status = useSessionStore((state) => state.status);
  const location = useLocation();
  useEffect(() => {
    if (status !== "authenticated") rememberTarget(location.pathname + location.search);
  }, [status, location.pathname, location.search]);
  if (status !== "authenticated") {
    return <Navigate to={paths.welcome()} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireOnboarded() {
  const me = useMe();
  const location = useLocation();
  const recipient = new URLSearchParams(location.search).get("pushUser");
  if (me.isPending) return <AppSplash />;
  if (me.isError) return <ErrorState onRetry={() => void me.refetch()} className="h-app" />;
  if (recipient && recipient !== me.data.id) return <Navigate to={paths.notifications()} replace />;
  if (!me.data.onboardingCompletedAt) return <Navigate to={paths.onboarding()} replace />;
  return (
    <AuthenticatedRealtime userId={me.data.id}>
      <Outlet />
    </AuthenticatedRealtime>
  );
}

export function RedirectIfAuthed() {
  const status = useSessionStore((state) => state.status);
  if (status === "authenticated") return <Navigate to={paths.home()} replace />;
  return <Outlet />;
}

/**
 * Overlay routes render in a second <Routes> outside the guarded tree: only show
 * them once the background (which carries the guards) has a ready, onboarded user.
 */
export function OverlayGate({ children }: { children: ReactNode }) {
  const status = useSessionStore((state) => state.status);
  const me = useMe();
  const location = useLocation();
  const recipient = new URLSearchParams(location.search).get("pushUser");
  if (status !== "authenticated" || !me.data?.onboardingCompletedAt) return null;
  if (recipient && recipient !== me.data.id) return <Navigate to={paths.notifications()} replace />;
  return children;
}
