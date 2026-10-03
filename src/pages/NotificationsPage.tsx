import { Bell } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { NotificationItem } from "@/features/notifications/components/NotificationItem";
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/features/notifications/hooks/useNotifications";
import { groupNotifications } from "@/features/notifications/lib/groupNotifications";
import { useFollowToggle } from "@/features/profile/hooks/useFollowToggle";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { ContentColumn } from "@/layouts/ContentColumn";
import type { Notification } from "@/types/notification";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();
  const isMobile = useIsMobile();
  const me = useCurrentUser();
  const notifications = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const follow = useFollowToggle();
  const { mutate: markRead } = markAllRead;
  const groups = useMemo(
    () => groupNotifications(notifications.data ?? [], new Date()),
    [notifications.data],
  );

  useEffect(() => {
    if (notifications.data?.some((n) => !n.readAt)) markRead();
  }, [notifications.data, markRead]);

  function open(notification: Notification) {
    switch (notification.type) {
      case "new_message":
        navigate(paths.conversation(notification.conversationId));
        return;
      case "follow":
        overlayNavigate(paths.profile(notification.actor.username));
        return;
      default:
        overlayNavigate(paths.profile(me.username));
    }
  }

  return (
    <ContentColumn>
      <PageHeader
        title={t("notifications.title")}
        onBack={isMobile ? () => navigate(-1) : undefined}
      />
      {notifications.isPending && (
        <div className="space-y-3 p-4">
          {["a", "b", "c"].map((key) => (
            <Skeleton key={key} className="h-12" />
          ))}
        </div>
      )}
      {notifications.isError && <ErrorState onRetry={() => void notifications.refetch()} />}
      {notifications.data?.length === 0 && (
        <EmptyState
          icon={Bell}
          title={t("notifications.empty")}
          description={t("notifications.emptyDescription")}
        />
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
