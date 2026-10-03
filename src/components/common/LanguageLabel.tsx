import { getLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/language";

/** Language shown by its native name, tagged with `lang` for screen readers. */
export function LanguageLabel({
  code,
  showEnglish = false,
  className,
}: {
  code: LanguageCode;
  showEnglish?: boolean;
  className?: string;
}) {
  const language = getLanguage(code);
  if (!language) return <span className={className}>{code}</span>;
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span lang={language.code} dir={language.dir}>
        {language.nativeName}
      </span>
      {showEnglish && language.englishName !== language.nativeName && (
        <span className="text-xs text-muted-foreground">{language.englishName}</span>
      )}
    </span>
  );
}
