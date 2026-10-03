import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useMe } from "@/features/auth/hooks/useMe";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { profileService, type PreferencesPatch } from "@/services/profileService";
import type { CurrentUser } from "@/types/user";
import type { TranslationPreference } from "@/types/preferences";

/** Account-level translation preferences (server state, PLAN.md §11.2). */
export function useTranslationPreferences(): TranslationPreference {
  const { data } = useMe();
  return data?.preferences.translation ?? DEFAULT_PREFERENCES.translation;
}

function applyPatch(user: CurrentUser, patch: PreferencesPatch): CurrentUser {
  const current = user.preferences;
  return {
    ...user,
    preferences: {
      interfaceLanguage: patch.interfaceLanguage ?? current.interfaceLanguage,
      translation: { ...current.translation, ...patch.translation },
      privacy: { ...current.privacy, ...patch.privacy },
      notifications: { ...current.notifications, ...patch.notifications },
    },
  };
}

/** Optimistic preference update with rollback. Changing the receiving language refetches content. */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: PreferencesPatch) => profileService.updatePreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.me() });
      const previous = queryClient.getQueryData<CurrentUser>(profileKeys.me());
      if (previous) queryClient.setQueryData(profileKeys.me(), applyPatch(previous, patch));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(profileKeys.me(), context.previous);
    },
    onSuccess: (user, patch) => {
      queryClient.setQueryData(profileKeys.me(), user);
      if (patch.translation?.receivingLanguage) {
        // Projections depend on the receiving language: fetch everything again.
        void queryClient.invalidateQueries({ queryKey: ["chat"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
        void queryClient.invalidateQueries({ queryKey: ["stories"] });
      }
    },
  });
}
