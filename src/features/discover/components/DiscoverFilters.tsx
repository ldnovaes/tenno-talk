import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/common/LanguageSelect";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LanguageCode } from "@/types/language";

/** Native language filter now; country/learning/interests prepared (PLAN.md §9.5). */
export function DiscoverFilters({
  nativeLanguage,
  onNativeLanguageChange,
}: {
  nativeLanguage: LanguageCode | null;
  onNativeLanguageChange: (code: LanguageCode | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("discover.filters.label")}
      className="flex flex-wrap items-center gap-2 px-4 pb-3"
    >
      <div className="w-56">
        <LanguageSelect
          value={nativeLanguage}
          onChange={onNativeLanguageChange}
          placeholder={t("discover.filters.nativeLanguage")}
          label={t("discover.filters.nativeLanguage")}
        />
      </div>
      {nativeLanguage && (
        <Button variant="ghost" size="sm" onClick={() => onNativeLanguageChange(null)}>
          {t("discover.filters.anyLanguage")}
        </Button>
      )}
      {(["country", "learningLanguage", "interests"] as const).map((filter) => (
        <Tooltip key={filter}>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="rounded-full">
              <Button variant="outline" size="sm" disabled className="rounded-full" tabIndex={-1}>
                {t(`discover.filters.${filter}`)}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("common.comingSoon")}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
