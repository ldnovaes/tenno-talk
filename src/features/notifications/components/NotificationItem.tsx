import { useTranslation } from "react-i18next";

import { RelativeTime } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/common/UserAvatar";
import type { Notification } from "@/types/notification";

import { describeNotification } from "../lib/notificationText";
import { NotificationActions } from "./NotificationActions";

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
}

/** Same row anatomy as the conversation list: avatar, name + time, then one line of detail. */
export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  const { t } = useTranslation();
  const unread = !notification.readAt;
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start outline-offset-2"
      >
        <UserAvatar user={notification.actor} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold" dir="auto">
              {notification.actor.displayName}
            </span>
            <RelativeTime
              iso={notification.createdAt}
              className="ms-auto shrink-0 text-xs text-muted-foreground"
            />
          </span>
          <span className="flex items-center gap-2">
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {describeNotification(notification, t)}
            </span>
            {unread && (
              <span
                role="img"
                aria-label={t("notifications.unread")}
                className="ms-auto size-2.5 shrink-0 rounded-full bg-unread"
              />
            )}
          </span>
        </span>
      </button>
      <NotificationActions notification={notification} />
    </li>
  );
}
