import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  current: number;
  total: number;
  onBack?: (() => void) | undefined;
  footer: ReactNode;
  children: ReactNode;
}

/** Step frame: progress on top, content, sticky footer (PLAN.md §9.2). */
export function OnboardingLayout({
  current,
  total,
  onBack,
  footer,
  children,
}: OnboardingLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-app w-full justify-center bg-background md:items-center md:bg-chat-bg md:p-6">
      <div className="flex h-full w-full flex-col pt-safe md:h-[min(760px,100%)] md:max-w-[480px] md:overflow-hidden md:rounded-2xl md:border md:bg-background md:shadow-sm">
        <header className="flex h-14 shrink-0 items-center gap-3 px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={t("common.back")}
            className={cn(!onBack && "invisible")}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Button>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current}
            aria-label={t("onboarding.stepOf", { current, total })}
            className="flex flex-1 gap-1.5 pe-12"
          >
            {Array.from({ length: total }, (_, index) => (
              <span
                key={`step-${index + 1}`}
                className={cn(
                  "h-1 flex-1 rounded-full bg-muted transition-colors",
                  index < current && "bg-primary",
                )}
              />
            ))}
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4">{children}</div>
        <footer className="shrink-0 border-t bg-background px-6 py-4 pb-safe">
          <div className="pb-2 md:pb-0">{footer}</div>
        </footer>
      </div>
    </div>
  );
}
