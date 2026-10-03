import type { NotificationService } from "@/services/notificationService";
import type { Notification } from "@/types/notification";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { projectNotification } from "../notificationProjection";
import { requireViewerId } from "../session";

export const mockNotificationService: NotificationService = {
  list() {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      return Object.values(db.notifications)
        .filter(
          (n) =>
            n.recipientId === viewerId && !db.users[viewerId]?.blockedUserIds.includes(n.actorId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => projectNotification(db, n))
        .filter((n): n is Notification => n !== null);
    });
  },

  unreadCount() {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      return Object.values(mockDb.read().notifications).filter(
        (n) => n.recipientId === viewerId && !n.readAt,
      ).length;
    });
  },

  markAllRead() {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        const now = new Date().toISOString();
        for (const notification of Object.values(db.notifications)) {
          if (notification.recipientId === viewerId && !notification.readAt)
            notification.readAt = now;
        }
      }),
    );
  },
};
