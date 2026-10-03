import { AtSign, Check, Loader2 } from "lucide-react";
import type { RefCallBack } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeUsername, validateUsername } from "@/lib/username";

import { useUsernameAvailability } from "../hooks/useOnboardingMutations";

/** Username input with live format + availability feedback. */
interface UsernameFieldProps {
  field: {
    name: string;
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    ref: RefCallBack;
  };
}

export function UsernameField({ field }: UsernameFieldProps) {
  const { t } = useTranslation();
  const normalized = normalizeUsername(field.value);
  const debounced = useDebouncedValue(normalized, 400);
  const availability = useUsernameAvailability(debounced);
  const formatOk = normalized.length > 0 && validateUsername(normalized) === null;
  const settled = debounced === normalized;

  let status: string | null = null;
  if (formatOk && (!settled || availability.isFetching))
    status = t("onboarding.profile.usernameChecking");
  else if (formatOk && availability.data?.available)
    status = t("onboarding.profile.usernameAvailable");

  return (
    <FormItem>
      <FormLabel>{t("onboarding.profile.username")}</FormLabel>
      <div className="relative">
        <AtSign
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <FormControl>
          <Input
            {...field}
            onChange={(event) => field.onChange(normalizeUsername(event.target.value))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="ps-9 pe-9"
          />
        </FormControl>
        {formatOk && settled && availability.data?.available && (
          <Check
            className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-online"
            aria-hidden
          />
        )}
        {formatOk && (!settled || availability.isFetching) && (
          <Loader2
            className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
      <FormDescription aria-live="polite">
        {status ?? t("onboarding.profile.usernameHint")}
      </FormDescription>
      {formatOk && settled && availability.data?.available === false ? (
        <p className="text-[0.8rem] font-medium text-destructive">
          {t("validation.username.taken")}
        </p>
      ) : (
        <FormMessage />
      )}
    </FormItem>
  );
}
