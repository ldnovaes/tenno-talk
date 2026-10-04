import { PushSettings } from "@/features/notifications/components/PushSettings";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useUpdatePreferences } from "@/features/auth/hooks/useUpdatePreferences";

import { SettingsGroup, SwitchRow } from "../SettingsRow";

const KEYS = ["messages", "comments", "likes", "followers"] as const;

export function NotificationSettings() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const update = useUpdatePreferences();
  return (
    <SettingsGroup>
      <PushSettings />
      {KEYS.map((key) => (
        <SwitchRow
          key={key}
          label={t(`settings.notificationsSection.${key}`)}
          checked={me.preferences.notifications[key]}
          onCheckedChange={(checked) => update.mutate({ notifications: { [key]: checked } })}
        />
      ))}
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {t("settings.notificationsSection.hint")}
      </p>
    </SettingsGroup>
  );
}
