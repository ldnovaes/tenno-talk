import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { OverlayLink } from "@/app/router/OverlayLink";
import { paths } from "@/app/router/paths";
import { LogoMark } from "@/components/common/Logo";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

import { NavBadge } from "./NavBadge";
import { PRIMARY_NAV, type NavKey } from "./navItems";

const itemClass =
  "relative grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

interface NavigationRailProps {
  me: User | null;
  badges: Partial<Record<NavKey, number>>;
}

/** Desktop/tablet navigation (PLAN.md §6.4). */
export function NavigationRail({ me, badges }: NavigationRailProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.main")}
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-e bg-surface py-3"
    >
      <LogoMark className="mb-4" />
      {PRIMARY_NAV.map(({ key, to, icon: Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <NavLink
              to={to}
              aria-label={t(`nav.${key}`)}
              className={({ isActive }) =>
                cn(itemClass, isActive && "bg-accent text-accent-foreground hover:bg-accent")
              }
            >
              <Icon className="size-[22px]" aria-hidden />
              <NavBadge count={badges[key] ?? 0} />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{t(`nav.${key}`)}</TooltipContent>
        </Tooltip>
      ))}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <OverlayLink to={paths.settings()} aria-label={t("nav.settings")} className={itemClass}>
              <Settings className="size-[22px]" aria-hidden />
            </OverlayLink>
          </TooltipTrigger>
          <TooltipContent side="right">{t("nav.settings")}</TooltipContent>
        </Tooltip>
        {me && (
          <Tooltip>
            <TooltipTrigger asChild>
              <OverlayLink
                to={paths.profile(me.username)}
                aria-label={t("nav.profile")}
                className="rounded-full"
              >
                <UserAvatar user={me} size="sm" />
              </OverlayLink>
            </TooltipTrigger>
            <TooltipContent side="right">{t("nav.profile")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
