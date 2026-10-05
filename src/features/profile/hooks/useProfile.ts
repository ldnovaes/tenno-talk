import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSetMe } from "@/features/auth/hooks/useMe";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { normalizeUsername } from "@/lib/username";
import { profileService, type UpdateProfileInput } from "@/services/profileService";

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileKeys.byUsername(normalizeUsername(username)),
    queryFn: () => profileService.getProfile(username),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => profileService.updateProfile(input),
    onSuccess: (user) => {
      setMe(user);
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
      // Names and avatars appear in conversations too.
      void queryClient.invalidateQueries({ queryKey: ["chat"] });
    },
    meta: { silent: true },
  });
}

/** A block changes what both people see everywhere (PLAN.md §31.1). */
function refreshAfterBlockChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: profileKeys.all }),
    queryClient.invalidateQueries({ queryKey: ["feed"] }),
    queryClient.invalidateQueries({ queryKey: ["stories"] }),
    queryClient.invalidateQueries({ queryKey: ["chat"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  ]);
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ userId }: { userId: string; name: string }) => profileService.block(userId),
    onSuccess: (_result, { name }) => {
      toast.success(t("profile.blocked", { name }));
      void refreshAfterBlockChange(queryClient);
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ userId }: { userId: string; name: string }) => profileService.unblock(userId),
    onSuccess: (_result, { name }) => {
      toast.success(t("profile.unblocked", { name }));
      void refreshAfterBlockChange(queryClient);
    },
  });
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: profileKeys.blocked(),
    queryFn: () => profileService.getBlockedUsers(),
  });
}
