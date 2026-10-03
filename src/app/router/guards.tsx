import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { ErrorState } from "@/components/common/ErrorState";
import { AppSplash } from "@/features/auth/components/AppSplash";
import { useMe } from "@/features/auth/hooks/useMe";
import { useSessionStore } from "@/stores/sessionStore";

import { paths } from "./paths";

/** UX only: the server is the source of authorization (PLAN.md §31). */
export function RequireAuth() {
  const status = useSessionStore((state) => state.status);
  const location = useLocation();
  if (status !== "authenticated") {
    return <Navigate to={paths.welcome()} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireOnboarded() {
  const me = useMe();
  if (me.isPending) return <AppSplash />;
  if (me.isError) return <ErrorState onRetry={() => void me.refetch()} className="h-app" />;
  if (!me.data.onboardingCompletedAt) return <Navigate to={paths.onboarding()} replace />;
  return <Outlet />;
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
  if (status !== "authenticated" || !me.data?.onboardingCompletedAt) return null;
  return children;
}
