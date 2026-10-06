import type { NotificationService } from "@/services/notificationService";
import type { Notification } from "@/types/notification";

import { publish } from "../events";
import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { projectNotification } from "../notificationProjection";
import { requireViewerId } from "../session";

export const mockNotificationService: NotificationService = {
  markRead(ids) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = requireViewerId();
        for (const id of ids) {
          const n = db.notifications[id];
          if (n?.recipientId === viewer && !n.readAt) n.readAt = new Date().toISOString();
        }
      }),
    ).then(() => {
      publish({ kind: "notifications.read", recipientId: requireViewerId() });
    });
  },
  list(beforeId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const ordered = Object.values(db.notifications)
        .filter(
          (n) =>
            n.recipientId === viewerId &&
            !db.users[viewerId]?.blockedUserIds.includes(n.actorId) &&
            !db.users[n.actorId]?.blockedUserIds.includes(viewerId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((n) => projectNotification(db, n))
        .filter((n): n is Notification => n !== null);
      // Like the backend: a cursor that isn't in this list gives nothing, never a restart from the top.
      const position = beforeId ? ordered.findIndex((n) => n.id === beforeId) : -1;
      if (beforeId && position === -1) return [];
      const start = position + 1;
      return ordered.slice(start, start + 100);
    });
  },

  unreadCount() {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      return Object.values(db.notifications).filter(
        (n) =>
          n.recipientId === viewerId &&
          !n.readAt &&
          !db.users[viewerId]?.blockedUserIds.includes(n.actorId) &&
          !db.users[n.actorId]?.blockedUserIds.includes(viewerId),
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
    ).then(() => {
      publish({ kind: "notifications.read", recipientId: requireViewerId() });
    });
  },
};
