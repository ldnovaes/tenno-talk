import { differenceInCalendarDays, format, isSameYear } from "date-fns";

import type { ISODateString } from "@/types/api";

/** Conversation list timestamp: "09:42", "Yesterday", "Mon", "12/03" or "12/03/2025". */
export function formatListTimestamp(
  iso: ISODateString,
  now: Date,
  labels: { yesterday: string },
): string {
  const date = new Date(iso);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return format(date, "HH:mm");
  if (days === 1) return labels.yesterday;
  if (days < 7) return format(date, "EEE");
  return isSameYear(date, now) ? format(date, "dd/MM") : format(date, "dd/MM/yyyy");
}

export function formatTime(iso: ISODateString): string {
  return format(new Date(iso), "HH:mm");
}

export type DayLabel = { kind: "today" } | { kind: "yesterday" } | { kind: "date"; date: string };

/** Day divider label in a conversation. */
export function dayLabel(iso: ISODateString, now: Date): DayLabel {
  const date = new Date(iso);
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return { kind: "today" };
  if (days === 1) return { kind: "yesterday" };
  return {
    kind: "date",
    date: isSameYear(date, now) ? format(date, "d MMMM") : format(date, "d MMMM yyyy"),
  };
}

/** Local calendar day key, e.g. "2026-10-03". */
export function dayKey(iso: ISODateString): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

/** Relative "last seen" bucket used by presence labels. */
export function minutesSince(iso: ISODateString, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
}
