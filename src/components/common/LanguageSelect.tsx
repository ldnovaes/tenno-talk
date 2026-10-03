import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import type { LanguageCode } from "@/types/language";

interface LanguageSelectProps {
  id?: string | undefined;
  value: LanguageCode | null;
  onChange: (code: LanguageCode) => void;
  placeholder: string;
  exclude?: readonly LanguageCode[] | undefined;
  label?: string | undefined;
}

/** Compact single-language picker (native name first). */
export function LanguageSelect({
  id,
  value,
  onChange,
  placeholder,
  exclude = [],
  label,
}: LanguageSelectProps) {
  return (
    <Select {...(value ? { value } : {})} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.filter(
          (language) => !exclude.includes(language.code) || language.code === value,
        ).map((language) => (
          <SelectItem key={language.code} value={language.code}>
            <span lang={language.code} dir={language.dir}>
              {language.nativeName}
            </span>
            {language.englishName !== language.nativeName && (
              <span className="ms-2 text-xs text-muted-foreground">{language.englishName}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
