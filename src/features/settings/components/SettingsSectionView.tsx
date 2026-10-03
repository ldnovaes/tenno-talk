import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { SettingsSection } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";

import { AccountSettings } from "./sections/AccountSettings";
import { AppearanceSettings } from "./sections/AppearanceSettings";
import { LanguageSettings } from "./sections/LanguageSettings";
import { NotificationSettings } from "./sections/NotificationSettings";
import { PrivacySettings } from "./sections/PrivacySettings";
import { TranslationSettings } from "./sections/TranslationSettings";

const SECTIONS: Record<SettingsSection, ComponentType> = {
  account: AccountSettings,
  language: LanguageSettings,
  translation: TranslationSettings,
  appearance: AppearanceSettings,
  privacy: PrivacySettings,
  notifications: NotificationSettings,
};

/** One settings section with its own header (back goes to the section list). */
export function SettingsSectionView({
  section,
  onBack,
}: {
  section: SettingsSection;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const Section = SECTIONS[section];
  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t(`settings.sections.${section}`)} onBack={onBack} />
      <Section />
    </div>
  );
}
