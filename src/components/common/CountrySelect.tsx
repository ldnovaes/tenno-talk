import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_CODES, getCountryName } from "@/lib/countries";
import type { CountryCode } from "@/types/language";

import { CountryFlag } from "./CountryFlag";

interface CountrySelectProps {
  id?: string | undefined;
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  placeholder: string;
}

export function CountrySelect({ id, value, onChange, placeholder }: CountrySelectProps) {
  const options = useMemo(
    () =>
      COUNTRY_CODES.map((code) => ({ code, name: getCountryName(code) })).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [],
  );
  return (
    <Select {...(value ? { value } : {})} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.code} value={option.code}>
            <span className="flex items-center gap-2">
              <CountryFlag code={option.code} decorative />
              {option.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
