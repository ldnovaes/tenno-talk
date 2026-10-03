import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { notificationService } from "@/services/notificationService";
import { realtimeClient } from "@/services/realtime/realtimeClient";

import { notificationKeys } from "../lib/queryKeys";

export function useNotifications() {
  return useQuery({ queryKey: notificationKeys.list(), queryFn: () => notificationService.list() });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => notificationService.unreadCount(),
    meta: { silent: true },
  });
}

/** Opening the list clears the badge (optimistically). */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: () => queryClient.setQueryData(notificationKeys.unread(), 0),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.list() }),
    meta: { silent: true },
  });
}

/** New notifications pushed by the server refresh the list and the badge. */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      realtimeClient.subscribe("notification.created", () => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }),
    [queryClient],
  );
}
