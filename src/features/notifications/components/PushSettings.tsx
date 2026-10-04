import { usePushSettings } from "../hooks/usePushSettings";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function PushSettings() {
  const { t } = useTranslation();
  const { config, status, toggle, supported } = usePushSettings();
  const denied = supported && Notification.permission === "denied";
  return (
    <div className="space-y-3 px-4 py-4">
      <p className="font-medium">{t("notifications.pushTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("notifications.pushHint")}</p>
      <Button
        variant="outline"
        disabled={
          toggle.isPending || !supported || (!status.data && (!config.data?.enabled || denied))
        }
        onClick={() => toggle.mutate()}
      >
        {t(status.data ? "notifications.pushDisable" : "notifications.pushEnable")}
      </Button>
      {denied && !status.data && (
        <p className="text-sm text-muted-foreground">{t("notifications.pushDenied")}</p>
      )}
      {config.data && !config.data.enabled && (
        <p className="text-sm text-muted-foreground">{t("notifications.pushUnavailable")}</p>
      )}
    </div>
  );
}
