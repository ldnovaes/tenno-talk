import { useMutation, useQueryClient } from "@tanstack/react-query";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { profileService } from "@/services/profileService";

import { patchProfileInCaches, withFollowing } from "../lib/profileCache";

/** Optimistic follow/unfollow, rolled back on failure. */
export function useFollowToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) =>
      follow ? profileService.follow(userId) : profileService.unfollow(userId),
    onMutate: async ({ userId, follow }) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.all });
      patchProfileInCaches(queryClient, userId, (profile) => withFollowing(profile, follow));
    },
    onError: (_error, { userId, follow }) => {
      patchProfileInCaches(queryClient, userId, (profile) => withFollowing(profile, !follow));
    },
    onSuccess: (profile) => {
      patchProfileInCaches(queryClient, profile.id, () => profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
    },
  });
}
