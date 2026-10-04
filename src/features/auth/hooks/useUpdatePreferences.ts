import { useMutation, useQueryClient } from "@tanstack/react-query";

import { profileService, type PreferencesPatch } from "@/services/profileService";
import type { CurrentUser } from "@/types/user";
import { useSessionStore } from "@/stores/sessionStore";

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

const pendingByAccount = new Map<string, Promise<void>>();
const versions = new Map<string, number>();

/** A privacy change is authoritative after the server responds; rapid edits stay in order. */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const account = useSessionStore((state) => state.userId) ?? "";
  return useMutation({
    mutationFn: (patch: PreferencesPatch) => {
      const previous = pendingByAccount.get(account) ?? Promise.resolve();
      const operation = previous.then(() => profileService.updatePreferences(patch));
      const settled = operation.then(
        () => undefined,
        () => undefined,
      );
      pendingByAccount.set(account, settled);
      void settled.then(() => {
        if (pendingByAccount.get(account) === settled) pendingByAccount.delete(account);
      });
      return operation;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.me() });
      const previous = queryClient.getQueryData<CurrentUser>(profileKeys.me());
      const version = (versions.get(account) ?? 0) + 1;
      versions.set(account, version);
      if (previous) queryClient.setQueryData(profileKeys.me(), applyPatch(previous, patch));
      return { previous, version };
    },
    onError: (_error, _patch, context) => {
      if (context?.version === versions.get(account) && context.previous)
        queryClient.setQueryData(profileKeys.me(), context.previous);
    },
    onSuccess: (user, _patch, context) => {
      if (context && context.version === versions.get(account))
        queryClient.setQueryData(profileKeys.me(), user);
    },
    onSettled: (_user, _error, patch, context) => {
      if (!context || context.version !== versions.get(account)) return;
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      if (patch.privacy || patch.translation?.receivingLanguage) {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: profileKeys.all }),
          queryClient.invalidateQueries({ queryKey: ["feed"] }),
          queryClient.invalidateQueries({ queryKey: ["stories"] }),
          queryClient.invalidateQueries({ queryKey: ["chat"] }),
        ]);
      }
    },
  });
}
