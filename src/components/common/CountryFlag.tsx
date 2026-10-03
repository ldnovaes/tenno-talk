import {
  AE,
  AR,
  AU,
  BR,
  CA,
  CL,
  CN,
  CO,
  DE,
  EG,
  ES,
  FR,
  GB,
  ID,
  IN,
  IT,
  JP,
  KR,
  MX,
  NZ,
  PE,
  PH,
  PT,
  RU,
  SA,
  TH,
  US,
  VN,
} from "country-flag-icons/react/3x2";

import { getCountryName } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { CountryCode } from "@/types/language";

/** SVG flags: Windows does not render flag emoji (PLAN.md R6). */
const FLAGS = {
  AE,
  AR,
  AU,
  BR,
  CA,
  CL,
  CN,
  CO,
  DE,
  EG,
  ES,
  FR,
  GB,
  ID,
  IN,
  IT,
  JP,
  KR,
  MX,
  NZ,
  PE,
  PH,
  PT,
  RU,
  SA,
  TH,
  US,
  VN,
} as const;

function isKnownFlag(code: string): code is keyof typeof FLAGS {
  return code in FLAGS;
}

interface CountryFlagProps {
  code: CountryCode;
  className?: string;
  /** Hide from assistive tech when the country name is already written next to it. */
  decorative?: boolean;
}

export function CountryFlag({ code, className, decorative = false }: CountryFlagProps) {
  if (!isKnownFlag(code)) return null;
  const Flag = FLAGS[code];
  return (
    <Flag
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": getCountryName(code) })}
      className={cn("inline-block h-3 w-[18px] shrink-0 rounded-[2px] shadow-sm", className)}
    />
  );
}
