import { useId } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/common/LanguageSelect";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useUpdatePreferences } from "@/features/auth/hooks/useUpdatePreferences";
import { useUpdateProfile } from "@/features/profile/hooks/useProfile";

import { SettingsGroup } from "../SettingsRow";

/** The three languages are different things (PLAN.md §21). */
export function LanguageSettings() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const updatePreferences = useUpdatePreferences();
  const updateProfile = useUpdateProfile();
  const nativeId = useId();
  const receivingId = useId();
  const interfaceId = useId();

  return (
    <SettingsGroup>
      <div className="space-y-1.5 px-4 py-3">
        <Label htmlFor={nativeId}>{t("settings.languageSection.native")}</Label>
        <LanguageSelect
          id={nativeId}
          value={me.nativeLanguage}
          placeholder={t("profile.edit.chooseLanguage")}
          onChange={(nativeLanguage) =>
            updateProfile.mutate({
              displayName: me.displayName,
              username: me.username,
              bio: me.bio,
              country: me.country,
              avatarUrl: me.avatarUrl,
              nativeLanguage,
              learningLanguages: me.learningLanguages.filter((code) => code !== nativeLanguage),
            })
          }
        />
        <p className="text-sm text-muted-foreground">{t("settings.languageSection.nativeHint")}</p>
      </div>
      <div className="space-y-1.5 px-4 py-3">
        <Label htmlFor={receivingId}>{t("settings.languageSection.receiving")}</Label>
        <LanguageSelect
          id={receivingId}
          value={me.preferences.translation.receivingLanguage}
          placeholder={t("profile.edit.chooseLanguage")}
          onChange={(receivingLanguage) =>
            updatePreferences.mutate({ translation: { receivingLanguage } })
          }
        />
        <p className="text-sm text-muted-foreground">
          {t("settings.languageSection.receivingHint")}
        </p>
      </div>
      <div className="space-y-1.5 px-4 py-3">
        <Label htmlFor={interfaceId}>{t("settings.languageSection.interface")}</Label>
        <Select
          value="en-US"
          onValueChange={(interfaceLanguage) => updatePreferences.mutate({ interfaceLanguage })}
        >
          <SelectTrigger id={interfaceId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en-US">English</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t("settings.languageSection.interfaceHint")}
        </p>
      </div>
    </SettingsGroup>
  );
}
