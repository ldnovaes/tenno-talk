import { useMutation, useQueryClient } from "@tanstack/react-query";

import { profileService, type PreferencesPatch } from "@/services/profileService";
import type { CurrentUser } from "@/types/user";

import { profileKeys } from "../lib/queryKeys";

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
