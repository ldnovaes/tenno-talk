import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      <span className="grid size-14 place-items-center rounded-full bg-muted text-destructive">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="max-w-xs space-y-1">
        <h2 className="text-base font-semibold">{title ?? t("errors.pageTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {description ?? t("errors.pageDescription")}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
