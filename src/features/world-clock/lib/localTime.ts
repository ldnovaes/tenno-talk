export type DayPeriod = "morning" | "afternoon" | "night";

export interface LocalTime {
  /** 24-hour "HH:mm" in the given time zone. */
  time: string;
  /** Short weekday, day and month in the given locale (e.g. "Thu, Oct 9"). */
  date: string;
  period: DayPeriod;
}

/** 05:00–11:59 morning, 12:00–17:59 afternoon, otherwise night. */
export function dayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

export function getLocalTime(now: Date, timeZone: string, locale: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
  return { time: `${hour}:${minute}`, date, period: dayPeriod(Number(hour)) };
}
