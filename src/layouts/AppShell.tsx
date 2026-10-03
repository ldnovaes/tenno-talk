import { Outlet, useLocation } from "react-router";

import { useIsMobile } from "@/hooks/useBreakpoint";
import type { User } from "@/types/user";

import { BottomNav } from "./BottomNav";
import { NavigationRail } from "./NavigationRail";
import type { NavKey } from "./navItems";
import { hidesBottomNav } from "./shellRoutes";

export interface ShellData {
  me: User | null;
  badges: Partial<Record<NavKey, number>>;
}

/** Rail on md+, bottom nav on mobile (PLAN.md §6). */
export function AppShell({ data }: { data: ShellData }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const showBottomNav = isMobile && !hidesBottomNav(location.pathname);

  return (
    <div className="flex h-app w-full flex-col overflow-hidden bg-background md:flex-row">
      {!isMobile && <NavigationRail me={data.me} badges={data.badges} />}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      {showBottomNav && <BottomNav me={data.me} unreadChats={data.badges.chats ?? 0} />}
    </div>
  );
}
