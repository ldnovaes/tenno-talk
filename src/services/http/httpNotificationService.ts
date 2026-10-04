import type { NotificationService } from "@/services/notificationService";
import type { Notification } from "@/types/notification";

import { http } from "./httpClient";

export const httpNotificationService: NotificationService = {
  list: (beforeId) => http<Notification[]>("GET", "/api/notifications", { query: { beforeId } }),
  markRead: (ids) => http<void>("POST", "/api/notifications/read", { body: { ids } }),

  async unreadCount() {
    return (await http<{ count: number }>("GET", "/api/notifications/unread-count")).count;
  },

  markAllRead: () => http<void>("POST", "/api/notifications/read-all"),
};
