import { useMe } from "@/features/auth/hooks/useMe";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { TranslationPreference } from "@/types/preferences";

/** Account-level translation preferences (server state, PLAN.md §11.2). */
export function useTranslationPreferences(): TranslationPreference {
  const { data } = useMe();
  return data?.preferences.translation ?? DEFAULT_PREFERENCES.translation;
}

export { useUpdatePreferences } from "@/features/auth/hooks/useUpdatePreferences";
