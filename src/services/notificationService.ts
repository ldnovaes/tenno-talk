import type { Notification } from "@/types/notification";

import { mockNotificationService } from "./mock/implementations/mockNotificationService";
import { httpNotificationService } from "./http/httpNotificationService";

export interface NotificationService {
  list(beforeId?: string): Promise<Notification[]>;
  markRead(ids: string[]): Promise<void>;
  unreadCount(): Promise<number>;
  markAllRead(): Promise<void>;
}

export const notificationService: NotificationService = __USE_HTTP__
  ? httpNotificationService
  : mockNotificationService;
