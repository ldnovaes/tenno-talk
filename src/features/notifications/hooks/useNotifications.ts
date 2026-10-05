import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useOverlayNavigate } from "@/app/router/overlay";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useEffect } from "react";

import { chatKeys } from "@/features/chat/lib/queryKeys";
import { notificationService } from "@/services/notificationService";
import type { NotificationType } from "@/types/notification";
import { realtimeClient } from "@/services/realtime/realtimeClient";

import { notificationDestination } from "../lib/destination";
import { describeNotification } from "../lib/notificationText";
import { notificationKeys } from "../lib/queryKeys";

/** A follow, a request or an approval can lift a "People I follow" restriction in a chat (PLAN.md §31.1). */
const CHANGES_WHO_CAN_MESSAGE = new Set<NotificationType>([
  "follow",
  "follow_request",
  "follow_accepted",
]);

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam }) => notificationService.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => (page.length === 100 ? page.at(-1)?.id : undefined),
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => notificationService.unreadCount(),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    meta: { silent: true },
  });
}

/** Reads only the observed IDs; a concurrently arriving notification stays unread. */
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (let offset = 0; offset < ids.length; offset += 100)
        await notificationService.markRead(ids.slice(offset, offset + 100));
    },
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** New notifications pushed by the server refresh the list and the badge. */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();
  const { t } = useTranslation();
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    const unsubscribers = [
      realtimeClient.subscribe("notification.created", ({ notification }) => {
        refresh();
        if (CHANGES_WHO_CAN_MESSAGE.has(notification.type))
          void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
        const destination = notificationDestination(notification, me.id);
        toast(notification.actor.displayName, {
          id: notification.id,
          description: describeNotification(notification, t),
          action: {
            label: t("notifications.view"),
            onClick: () =>
              destination.overlay ? overlayNavigate(destination.to) : navigate(destination.to),
          },
        });
      }),
      realtimeClient.subscribe("notifications.read", refresh),
      // Notifications created while the connection was down.
      realtimeClient.onStatusChange((status) => {
        if (status === "open") refresh();
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [queryClient, me.id, navigate, overlayNavigate, t]);
}
