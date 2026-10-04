import type { Notification } from "@/types/notification";

import { mockNotificationService } from "./mock/implementations/mockNotificationService";
import { httpNotificationService } from "./http/httpNotificationService";

export interface NotificationService {
  list(): Promise<Notification[]>;
  unreadCount(): Promise<number>;
  markAllRead(): Promise<void>;
}

export const notificationService: NotificationService = __USE_HTTP__
  ? httpNotificationService
  : mockNotificationService;
