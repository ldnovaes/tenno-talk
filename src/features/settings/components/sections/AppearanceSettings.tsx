import { useTranslation } from "react-i18next";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";
import type { ThemePreference } from "@/types/preferences";

import { SettingsGroup } from "../SettingsRow";

const THEMES: ThemePreference[] = ["light", "dark", "system"];

export function AppearanceSettings() {
  const { t } = useTranslation();
  const theme = useDevicePreferencesStore((state) => state.theme);
  const setTheme = useDevicePreferencesStore((state) => state.setTheme);
  return (
    <>
      <SettingsGroup title={t("settings.appearanceSection.theme")}>
        <RadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as ThemePreference)}
          aria-label={t("settings.appearanceSection.theme")}
          className="gap-0"
        >
          {THEMES.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/60"
            >
              <RadioGroupItem
                value={option}
                aria-label={t(`settings.appearanceSection.${option}`)}
              />
              <span className="font-medium">{t(`settings.appearanceSection.${option}`)}</span>
            </label>
          ))}
        </RadioGroup>
      </SettingsGroup>
      <SettingsGroup title={t("settings.appearanceSection.preview")}>
        <div className="mx-4 my-2 flex flex-col gap-2 rounded-2xl bg-chat-bg p-4" aria-hidden>
          <span className="max-w-[80%] self-start rounded-2xl rounded-es-md bg-bubble-in px-3 py-2 text-sm shadow-sm">
            {t("settings.appearanceSection.previewIncoming")}
          </span>
          <span className="max-w-[80%] self-end rounded-2xl rounded-ee-md bg-bubble-out px-3 py-2 text-sm shadow-sm">
            {t("settings.appearanceSection.previewOutgoing")}
          </span>
        </div>
      </SettingsGroup>
    </>
  );
}
