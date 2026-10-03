import { Check, Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { searchLanguages } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/language";

import { CountryFlag } from "./CountryFlag";

interface LanguagePickerProps {
  value: LanguageCode | null;
  onChange: (code: LanguageCode) => void;
  label: string;
  /** Marks one option (e.g. the language detected from the device). */
  hint?: { code: LanguageCode; text: string } | undefined;
  className?: string;
}

/** Searchable single-choice language list; native name first (PLAN.md §9.2). */
export function LanguagePicker({ value, onChange, label, hint, className }: LanguagePickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const results = searchLanguages(query);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor={searchId} className="sr-only">
          {t("languagePicker.search")}
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("languagePicker.search")}
          className="ps-9"
        />
      </div>
      <div role="radiogroup" aria-label={label} className="min-h-0 flex-1 overflow-y-auto">
        {results.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("languagePicker.noResults")}
          </p>
        )}
        {results.map((language) => {
          const selected = language.code === value;
          return (
            <button
              key={language.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(language.code)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-muted",
                selected && "bg-accent hover:bg-accent",
              )}
            >
              <span className="grid w-[18px] place-items-center">
                {language.defaultCountry && (
                  <CountryFlag code={language.defaultCountry} decorative />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang={language.code} dir={language.dir} className="font-medium">
                  {language.nativeName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {language.englishName}
                  {hint?.code === language.code && ` · ${hint.text}`}
                </span>
              </span>
              {selected && <Check className="size-5 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
