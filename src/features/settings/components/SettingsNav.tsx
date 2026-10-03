import {
  Bell,
  ChevronRight,
  Globe,
  Languages,
  Lock,
  Palette,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { SETTINGS_SECTIONS, type SettingsSection } from "@/app/router/paths";

const ICONS: Record<SettingsSection, LucideIcon> = {
  account: UserRound,
  language: Globe,
  translation: Languages,
  appearance: Palette,
  privacy: Lock,
  notifications: Bell,
};

export function SettingsNav({ onSelect }: { onSelect: (section: SettingsSection) => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("settings.title")} className="py-2">
      <ul>
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = ICONS[section];
          return (
            <li key={section}>
              <button
                type="button"
                onClick={() => onSelect(section)}
                className="flex w-full items-center gap-4 px-4 py-3 text-start transition-colors hover:bg-muted"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(`settings.sections.${section}`)}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {t(`settings.sectionDescriptions.${section}`)}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
