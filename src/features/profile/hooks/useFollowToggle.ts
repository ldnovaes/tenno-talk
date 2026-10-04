import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSessionStore } from "@/stores/sessionStore";
import type { UserProfile } from "@/types/user";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { feedKeys } from "@/features/feed/lib/queryKeys";
import { storyKeys } from "@/features/stories/lib/queryKeys";
import { profileService } from "@/services/profileService";

import { patchProfileInCaches, withFollowing } from "../lib/profileCache";

const pendingByUser = new Map<string, Promise<void>>();
const versions = new Map<string, number>();
/** Serialize rapid taps for the same account/author; only the latest result changes the cache. */
export function useFollowToggle() {
  const queryClient = useQueryClient();
  const account = useSessionStore((state) => state.userId);
  const keyOf = (userId: string) => `${account}:${userId}`;
  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) => {
      const key = keyOf(userId);
      const prior = pendingByUser.get(key) ?? Promise.resolve();
      const operation: Promise<UserProfile> = prior.then(() =>
        follow ? profileService.follow(userId) : profileService.unfollow(userId),
      );
      const settled = operation.then(
        () => undefined,
        () => undefined,
      );
      pendingByUser.set(key, settled);
      void settled.then(() => {
        if (pendingByUser.get(key) === settled) pendingByUser.delete(key);
      });
      return operation;
    },
    onMutate: async ({ userId, follow }) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.all });
      const key = keyOf(userId);
      const version = (versions.get(key) ?? 0) + 1;
      versions.set(key, version);
      patchProfileInCaches(queryClient, userId, (profile) => withFollowing(profile, follow));
      return { version };
    },
    onError: (_error, { userId, follow }, context) => {
      if (context?.version === versions.get(keyOf(userId)))
        patchProfileInCaches(queryClient, userId, (profile) => withFollowing(profile, !follow));
    },
    onSuccess: async (profile, { userId }, context) => {
      if (context?.version !== versions.get(keyOf(userId))) return;
      patchProfileInCaches(queryClient, profile.id, () => profile);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: feedKeys.all }),
        queryClient.cancelQueries({ queryKey: storyKeys.all }),
      ]);
      await Promise.all([
        queryClient.resetQueries({ queryKey: feedKeys.list() }),
        queryClient.invalidateQueries({ queryKey: feedKeys.all }),
        queryClient.invalidateQueries({ queryKey: storyKeys.all }),
        queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
      ]);
    },
  });
}
