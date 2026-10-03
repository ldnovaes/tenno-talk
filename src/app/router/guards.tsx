import { Outlet } from "react-router";

// Phase 1: pass-through guards. Real session checks arrive in Phase 2.
export function RequireAuth() {
  return <Outlet />;
}

export function RequireOnboarded() {
  return <Outlet />;
}

export function RedirectIfAuthed() {
  return <Outlet />;
}
