import { paths } from "@/app/router/paths";
import type { Notification } from "@/types/notification";
export function notificationDestination(notification: Notification, viewerId: string) {
  switch (notification.type) {
    case "new_message":
      return {
        to:
          paths.conversation(notification.conversationId) +
          `?messageId=${encodeURIComponent(notification.messageId)}`,
        overlay: false,
      };
    case "follow":
    case "follow_request":
    case "follow_accepted":
      return { to: paths.profile(notification.actor.username), overlay: true };
    case "like":
      return { to: paths.post(notification.postId), overlay: true };
    case "comment":
      return { to: paths.post(notification.postId, notification.commentId), overlay: true };
    case "story_reaction":
      return {
        to: paths.story(viewerId) + `?storyId=${encodeURIComponent(notification.storyId)}`,
        overlay: true,
      };
  }
}
