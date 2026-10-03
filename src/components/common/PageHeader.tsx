import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}

/** Sticky screen header (mobile pages, panels, content columns). */
export function PageHeader({ title, onBack, actions, className }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        !onBack && "ps-4",
        className,
      )}
    >
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold">{title}</h1>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
