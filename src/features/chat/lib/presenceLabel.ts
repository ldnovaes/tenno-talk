import { format } from "date-fns";

import { minutesSince } from "@/lib/dates";

export type PresenceLabel =
  | { kind: "online" }
  | { kind: "justNow" }
  | { kind: "minutes"; count: number }
  | { kind: "hours"; count: number }
  | { kind: "date"; date: string }
  | { kind: "unknown" };

export function presenceLabel(
  presence: { isOnline: boolean; lastSeenAt: string | null },
  now: Date,
): PresenceLabel {
  if (presence.isOnline) return { kind: "online" };
  if (!presence.lastSeenAt) return { kind: "unknown" };
  const minutes = minutesSince(presence.lastSeenAt, now);
  if (minutes < 1) return { kind: "justNow" };
  if (minutes < 60) return { kind: "minutes", count: minutes };
  if (minutes < 24 * 60) return { kind: "hours", count: Math.floor(minutes / 60) };
  return { kind: "date", date: format(new Date(presence.lastSeenAt), "d MMM") };
}
