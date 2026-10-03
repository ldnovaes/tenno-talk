/** Seeds are generated relative to "now" so the demo always looks fresh. */
export function minutesAgo(minutes: number, now = Date.now()): string {
  return new Date(now - minutes * 60_000).toISOString();
}

export function hoursAgo(hours: number, now = Date.now()): string {
  return minutesAgo(hours * 60, now);
}

export function daysAgo(days: number, now = Date.now()): string {
  return minutesAgo(days * 24 * 60, now);
}
