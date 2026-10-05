import { useMutation, useQueryClient } from "@tanstack/react-query";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { notificationKeys } from "@/features/notifications/lib/queryKeys";
import { profileService } from "@/services/profileService";

/** Approve or decline a follow request (Settings → Privacy and the notification list). */
export function useFollowRequestDecision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, approve }: { userId: string; approve: boolean }) =>
      approve
        ? profileService.approveFollowRequest(userId)
        : profileService.rejectFollowRequest(userId),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: profileKeys.all }),
        client.invalidateQueries({ queryKey: profileKeys.me() }),
        client.invalidateQueries({ queryKey: notificationKeys.all }),
      ]),
  });
}
