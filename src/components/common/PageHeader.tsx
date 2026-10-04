import { useLocation } from "react-router";
import { NotificationBell } from "./NotificationBell";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useBack } from "@/app/router/useBack";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  onBack?: (() => void) | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
}

/** Sticky screen header (mobile pages, panels, content columns). */
export function PageHeader({ title, onBack, actions, className }: PageHeaderProps) {
  const { t } = useTranslation();
  const safeBack = useBack();
  const { pathname } = useLocation();
  const showBell = pathname === "/discover" || pathname.startsWith("/u/");
  const back = onBack ?? safeBack;
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        !back && "ps-4",
        className,
      )}
    >
      {back && (
        <Button variant="ghost" size="icon" onClick={back} aria-label={t("common.back")}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</h1>
      {showBell && (
        <span className="md:hidden">
          <NotificationBell />
        </span>
      )}
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
