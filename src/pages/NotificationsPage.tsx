import { Button } from "@/components/ui/button";
import { useBack } from "@/app/router/useBack";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { notificationDestination } from "@/features/notifications/lib/destination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { NotificationItem } from "@/features/notifications/components/NotificationItem";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import { groupNotifications } from "@/features/notifications/lib/groupNotifications";
import { useFollowToggle } from "@/features/profile/hooks/useFollowToggle";
import { ContentColumn } from "@/layouts/ContentColumn";
import type { Notification } from "@/types/notification";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const backSafe = useBack();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();
  const me = useCurrentUser();
  const notifications = useNotifications();
  const markAllRead = useMarkNotificationsRead();
  const items = notifications.data?.pages.flat() ?? [];
  const follow = useFollowToggle();
  const { mutate: markRead } = markAllRead;
  const groups = groupNotifications(items, new Date());

  function open(notification: Notification) {
    if (!notification.readAt) markRead([notification.id]);
    const destination = notificationDestination(notification, me.id);
    if (destination.overlay) overlayNavigate(destination.to);
    else navigate(destination.to);
  }

  return (
    <ContentColumn>
      <PageHeader
        title={t("notifications.title")}
        onBack={backSafe}
        actions={
          <Button
            variant="ghost"
            disabled={markAllRead.isPending || !items.some((n) => !n.readAt)}
            onClick={() => markRead(items.filter((n) => !n.readAt).map((n) => n.id))}
          >
            {t("notifications.markAllRead")}
          </Button>
        }
      />
      {notifications.isPending && (
        <div className="space-y-3 p-4">
          {["a", "b", "c"].map((key) => (
            <Skeleton key={key} className="h-12" />
          ))}
        </div>
      )}
      {notifications.isError && <ErrorState onRetry={() => void notifications.refetch()} />}
      {notifications.isSuccess && items.length === 0 && (
        <EmptyState
          icon={Bell}
          title={t("notifications.empty")}
          description={t("notifications.emptyDescription")}
        />
      )}
      {notifications.hasNextPage && (
        <Button
          variant="ghost"
          disabled={notifications.isFetchingNextPage}
          onClick={() => void notifications.fetchNextPage()}
        >
          {t("common.loadMore")}
        </Button>
      )}
      {groups.map((group) => (
        <section key={group.period} aria-labelledby={`notifications-${group.period}`}>
          <h2 id={`notifications-${group.period}`} className="px-4 pb-1 pt-4 text-sm font-semibold">
            {t(`notifications.${group.period}`)}
          </h2>
          <ul>
            {group.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={open}
                onFollowBack={(userId) => follow.mutate({ userId, follow: true })}
              />
            ))}
          </ul>
        </section>
      ))}
    </ContentColumn>
  );
}
