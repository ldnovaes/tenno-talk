import { useTranslation } from "react-i18next";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useTranslationPreferences,
  useUpdatePreferences,
} from "@/features/translation/hooks/useTranslationPreferences";
import type { TranslationDisplayMode } from "@/types/preferences";

import { SettingsGroup, SwitchRow } from "../SettingsRow";

const MODES: TranslationDisplayMode[] = ["translation", "both", "original"];

export function TranslationSettings() {
  const { t } = useTranslation();
  const preferences = useTranslationPreferences();
  const update = useUpdatePreferences();

  return (
    <>
      <SettingsGroup title={t("settings.translationSection.displayTitle")}>
        <RadioGroup
          value={preferences.displayMode}
          onValueChange={(value) =>
            update.mutate({ translation: { displayMode: value as TranslationDisplayMode } })
          }
          aria-label={t("settings.translationSection.displayTitle")}
          className="gap-0"
        >
          {MODES.map((mode) => (
            <label
              key={mode}
              className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/60"
            >
              <RadioGroupItem
                value={mode}
                className="mt-0.5"
                aria-label={t(`settings.translationSection.display.${mode}`)}
              />
              <span className="min-w-0">
                <span className="block font-medium">
                  {t(`settings.translationSection.display.${mode}`)}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t(`settings.translationSection.display.${mode}Hint`)}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </SettingsGroup>
      <SettingsGroup>
        <SwitchRow
          label={t("settings.translationSection.autoPosts")}
          checked={preferences.autoTranslatePosts}
          onCheckedChange={(checked) =>
            update.mutate({ translation: { autoTranslatePosts: checked } })
          }
        />
        <SwitchRow
          label={t("settings.translationSection.autoStories")}
          checked={preferences.autoTranslateStories}
          onCheckedChange={(checked) =>
            update.mutate({ translation: { autoTranslateStories: checked } })
          }
        />
      </SettingsGroup>
      <SettingsGroup>
        <SwitchRow
          label={t("settings.translationSection.learningMode")}
          description={t("settings.translationSection.learningModeHint")}
          checked={preferences.learningMode}
          onCheckedChange={(checked) => update.mutate({ translation: { learningMode: checked } })}
        />
      </SettingsGroup>
    </>
  );
}
