import { Compass, LayoutGrid, MessageCircle, Plus, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { paths } from "@/app/router/paths";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

import { NavBadge } from "./NavBadge";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors",
    isActive && "text-primary",
  );

interface BottomNavProps {
  me: User | null;
  unreadChats: number;
}

/** Mobile tab bar: Chats · Discover · Create · Feed · Profile (PLAN.md §6.2). */
export function BottomNav({ me, unreadChats }: BottomNavProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.main")}
      className="shrink-0 border-t bg-background/95 pb-safe backdrop-blur"
    >
      <div className="flex h-14 items-stretch">
        <NavLink to={paths.chats()} className={tabClass}>
          <span className="relative">
            <MessageCircle className="size-6" aria-hidden />
            <NavBadge count={unreadChats} />
          </span>
          {t("nav.chats")}
        </NavLink>
        <NavLink to={paths.discover()} className={tabClass}>
          <Compass className="size-6" aria-hidden />
          {t("nav.discover")}
        </NavLink>
        <NavLink
          to={paths.create()}
          aria-label={t("nav.create")}
          className="flex flex-1 items-center justify-center"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95">
            <Plus className="size-6" aria-hidden />
          </span>
        </NavLink>
        <NavLink to={paths.feed()} className={tabClass}>
          <LayoutGrid className="size-6" aria-hidden />
          {t("nav.feed")}
        </NavLink>
        <NavLink to={me ? paths.profile(me.username) : paths.settings()} className={tabClass}>
          <UserIcon className="size-6" aria-hidden />
          {t("nav.profile")}
        </NavLink>
      </div>
    </nav>
  );
}
