import { useTranslation } from "react-i18next";

import { RelativeTime } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification";

function describe(notification: Notification, t: ReturnType<typeof useTranslation>["t"]): string {
  switch (notification.type) {
    case "like":
      return t("notifications.like");
    case "comment":
      return t("notifications.comment");
    case "follow":
      return t("notifications.follow");
    case "story_reaction":
      return t("notifications.storyReaction", { emoji: notification.emoji });
    case "new_message":
      return t("notifications.newMessage");
  }
}

interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  onFollowBack?: ((userId: string) => void) | undefined;
}

export function NotificationItem({ notification, onOpen, onFollowBack }: NotificationItemProps) {
  const { t } = useTranslation();
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", !notification.readAt && "bg-accent/40")}>
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <UserAvatar user={notification.actor} size="md" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{notification.actor.displayName}</span>{" "}
          {describe(notification, t)}{" "}
          <RelativeTime iso={notification.createdAt} className="text-muted-foreground" />
        </span>
      </button>
      {notification.type === "follow" && onFollowBack ? (
        <Button size="sm" onClick={() => onFollowBack(notification.actor.id)}>
          {t("notifications.followBack")}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => onOpen(notification)}>
          {t("notifications.view")}
        </Button>
      )}
    </li>
  );
}
