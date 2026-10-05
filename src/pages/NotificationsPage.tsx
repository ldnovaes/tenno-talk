import { Button } from "@/components/ui/button";
import { useBack } from "@/app/router/useBack";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { notificationDestination } from "@/features/notifications/lib/destination";
import { AvatarListSkeleton } from "@/components/common/AvatarListSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionTitle } from "@/components/common/SectionTitle";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { NotificationItem } from "@/features/notifications/components/NotificationItem";
import { PushPrompt } from "@/features/notifications/components/PushPrompt";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import { groupNotifications } from "@/features/notifications/lib/groupNotifications";
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
      <PushPrompt />
      {notifications.isPending && <AvatarListSkeleton />}
      {notifications.isError && <ErrorState onRetry={() => void notifications.refetch()} />}
      {notifications.isSuccess && items.length === 0 && (
        <EmptyState
          icon={Bell}
          title={t("notifications.empty")}
          description={t("notifications.emptyDescription")}
        />
      )}
      <div className="px-2 pb-2">
        {groups.map((group) => (
          <section key={group.period} aria-labelledby={`notifications-${group.period}`}>
            <SectionTitle id={`notifications-${group.period}`}>
              {t(`notifications.${group.period}`)}
            </SectionTitle>
            <ul>
              {group.items.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onOpen={open} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <InfiniteScrollTrigger
        disabled={!notifications.hasNextPage || notifications.isFetchingNextPage}
        onVisible={() => void notifications.fetchNextPage()}
      />
    </ContentColumn>
  );
}
