import { differenceInCalendarDays } from "date-fns";

import type { Notification } from "@/types/notification";

export type NotificationPeriod = "today" | "thisWeek" | "earlier";

export interface NotificationGroup {
  period: NotificationPeriod;
  items: Notification[];
}

/** Today / This week / Earlier, keeping the input order (newest first). PLAN.md §9.10. */
export function groupNotifications(list: readonly Notification[], now: Date): NotificationGroup[] {
  const groups = new Map<NotificationPeriod, Notification[]>();
  for (const notification of list) {
    const days = differenceInCalendarDays(now, new Date(notification.createdAt));
    const period: NotificationPeriod = days <= 0 ? "today" : days < 7 ? "thisWeek" : "earlier";
    groups.set(period, [...(groups.get(period) ?? []), notification]);
  }
  return (["today", "thisWeek", "earlier"] as const)
    .filter((period) => groups.has(period))
    .map((period) => ({ period, items: groups.get(period) ?? [] }));
}
