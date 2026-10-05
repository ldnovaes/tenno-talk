import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { usePushOffer } from "../hooks/usePushSettings";

/** Invites this device to receive notifications with the app closed (asks only on tap). */
export function PushPrompt() {
  const { t } = useTranslation();
  const { offer, enable, pending, dismiss } = usePushOffer();
  if (!offer) return null;
  return (
    <section
      aria-labelledby="push-prompt-title"
      className="mx-2 mb-2 mt-3 flex gap-3 rounded-2xl border bg-card p-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <BellRing className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <h2 id="push-prompt-title" className="font-semibold">
            {t("notifications.pushPromptTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              offer === "install"
                ? "notifications.pushPromptInstall"
                : "notifications.pushPromptBody",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {offer === "ask" && (
            <Button size="sm" disabled={pending} onClick={enable}>
              {t("notifications.pushPromptAction")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("notifications.pushPromptLater")}
          </Button>
        </div>
      </div>
    </section>
  );
}
