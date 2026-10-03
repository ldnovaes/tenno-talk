import { useTranslation } from "react-i18next";

import type { SettingsSection } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";

import { TranslationSettings } from "./sections/TranslationSettings";

/** One settings section with its own header (back goes to the section list). */
export function SettingsSectionView({
  section,
  onBack,
}: {
  section: SettingsSection;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const title = t(`settings.sections.${section}`);
  if (section !== "translation") return <PlaceholderScreen name={title} />;
  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={title} onBack={onBack} />
      <TranslationSettings />
    </div>
  );
}
