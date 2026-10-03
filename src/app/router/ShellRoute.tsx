import { useMe } from "@/features/auth/hooks/useMe";
import { AppShell } from "@/layouts/AppShell";

/** Feeds the shell with the current user and navigation badges. */
export function ShellRoute() {
  const me = useMe().data ?? null;
  return <AppShell data={{ me, badges: {} }} />;
}
