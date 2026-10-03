import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageSelect } from "@/components/common/LanguageSelect";
import { getLanguage } from "@/lib/languages";
import type { LanguageCode } from "@/types/language";

const MAX_LEARNING = 5;

/** Chips for the languages someone is learning + a picker to add more. */
export function LearningLanguagesField({
  id,
  value,
  native,
  onChange,
}: {
  id: string;
  value: LanguageCode[];
  native: LanguageCode;
  onChange: (value: LanguageCode[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((code) => {
            const name = getLanguage(code)?.nativeName ?? code;
            return (
              <li
                key={code}
                className="flex items-center gap-1 rounded-full bg-accent py-1 ps-3 pe-1 text-sm text-accent-foreground"
              >
                <span lang={code}>{name}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((item) => item !== code))}
                  aria-label={t("profile.edit.removeLanguage", { language: name })}
                  className="grid size-6 place-items-center rounded-full hover:bg-background/60"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {value.length < MAX_LEARNING && (
        <LanguageSelect
          id={id}
          value={null}
          onChange={(code) => onChange([...value, code])}
          placeholder={t("profile.edit.addLanguage")}
          exclude={[native, ...value]}
          label={t("profile.edit.addLanguage")}
        />
      )}
    </div>
  );
}
