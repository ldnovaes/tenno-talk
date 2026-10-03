import type { Notification } from "@/types/notification";

import { mockNotificationService } from "./mock/implementations/mockNotificationService";

export interface NotificationService {
  list(): Promise<Notification[]>;
  unreadCount(): Promise<number>;
  markAllRead(): Promise<void>;
}

export const notificationService: NotificationService = mockNotificationService;
