import { KeyRound, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RelativeTime } from "@/components/common/RelativeTime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProviderState } from "@/types/admin";

import { canReauth, providerName, providerTone } from "../lib/providers";

const TONE_CLASS = {
  ok: "bg-muted text-foreground before:me-1.5 before:inline-block before:size-2 before:rounded-full before:bg-online",
  warning: "bg-accent text-accent-foreground",
  danger: "bg-destructive/15 text-destructive",
} as const;

interface ProviderCardProps {
  provider: ProviderState;
  primary: boolean;
  onCheck: () => void;
  onReauth: () => void;
  busy: boolean;
}

export function ProviderCard({ provider, primary, onCheck, onReauth, busy }: ProviderCardProps) {
  const { t } = useTranslation();
  const tone = providerTone(provider.state);
  return (
    <article className="space-y-3 rounded-2xl border bg-card p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{providerName(provider.provider)}</h2>
          <p className="text-sm text-muted-foreground">
            {primary ? t("admin.ai.primary") : t("admin.ai.fallback")}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE_CLASS[tone])}>
          {t(`admin.ai.states.${provider.state}`)}
        </span>
      </header>
      {provider.lastError && provider.state !== "ok" && (
        <p className="break-words text-sm text-muted-foreground">{provider.lastError}</p>
      )}
      {provider.until && provider.state === "cooling_down" && (
        <p className="text-sm text-muted-foreground">
          {t("admin.ai.backAt")} <RelativeTime iso={provider.until} />
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onCheck} disabled={busy}>
          <RefreshCw className="size-4" aria-hidden />
          {t("admin.ai.check")}
        </Button>
        {canReauth(provider.state) && (
          <Button size="sm" onClick={onReauth} disabled={busy}>
            <KeyRound className="size-4" aria-hidden />
            {t("admin.ai.reauth")}
          </Button>
        )}
      </div>
    </article>
  );
}
