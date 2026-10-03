import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { isTranslationDelayed } from "../lib/resolveMessageDisplay";

/** Discreet status under a text that is waiting for (or failed) its translation. */
export function TranslationHint({
  hint,
  since,
  onRetry,
  retrying,
}: {
  hint: "translating" | "failed";
  since: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (hint !== "translating") return;
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, [hint]);

  if (hint === "failed") {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-xs opacity-80">
        <AlertCircle className="size-3.5" aria-hidden />
        <span>{t("translation.failed")}</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-60"
        >
          {t("translation.retry")}
        </button>
      </span>
    );
  }
  if (isTranslationDelayed(since, now)) {
    return <span className="mt-0.5 block text-xs opacity-70">{t("translation.delayed")}</span>;
  }
  return <span className="sr-only">{t("translation.translating")}</span>;
}
