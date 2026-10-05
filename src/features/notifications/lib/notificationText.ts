import type { TFunction } from "i18next";

import type { Notification } from "@/types/notification";

/** What the actor did, shared by the list, the toast and (in wording) the server push. */
export function describeNotification(notification: Notification, t: TFunction): string {
  switch (notification.type) {
    case "like":
      return t("notifications.like");
    case "comment":
      return t("notifications.comment");
    case "follow":
      return t("notifications.follow");
    case "follow_request":
      return t("notifications.followRequest");
    case "follow_accepted":
      return t("notifications.followAccepted");
    case "story_reaction":
      return t("notifications.storyReaction", { emoji: notification.emoji });
    case "new_message":
      return t("notifications.newMessage");
  }
}
