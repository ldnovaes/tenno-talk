import type { DiscoverEvent, DiscoverEventKind } from "@/types/discover";

/**
 * What the viewer is looking at in Discover (PLAN.md §37.7). One post is active at a time (the slide on
 * screen); each post counts one impression per page load, and the visible time is reported when it leaves.
 */
export interface ViewingState {
  active: { postId: string; since: number } | null;
  impressed: ReadonlySet<string>;
}

export interface PendingEvent {
  kind: DiscoverEventKind;
  postId: string;
  value?: number;
}

export const initialViewing: ViewingState = { active: null, impressed: new Set() };

/** Visible time is capped like on the server: a phone left on a post is not ten hours of interest. */
export const MAX_DWELL_MS = 10 * 60_000;

/** The active post changed to {@code postId} (null: nothing on screen, e.g. the tab was hidden). */
export function view(
  state: ViewingState,
  postId: string | null,
  now: number,
): { state: ViewingState; events: PendingEvent[] } {
  if (state.active?.postId === postId) return { state, events: [] };
  const events: PendingEvent[] = [];
  if (state.active) {
    const value = Math.min(MAX_DWELL_MS, Math.max(0, now - state.active.since));
    events.push({ kind: "dwell", postId: state.active.postId, value });
  }
  let impressed = state.impressed;
  if (postId !== null && !impressed.has(postId)) {
    events.push({ kind: "impression", postId });
    impressed = new Set([...impressed, postId]);
  }
  return { state: { active: postId === null ? null : { postId, since: now }, impressed }, events };
}

/** Stamps pending events for the wire. */
export function toDiscoverEvents(
  pending: PendingEvent[],
  now: number,
  newId: () => string = () => crypto.randomUUID(),
): DiscoverEvent[] {
  const at = new Date(now).toISOString();
  return pending.map((event) => ({
    clientId: newId(),
    postId: event.postId,
    kind: event.kind,
    ...(event.value === undefined ? {} : { value: Math.round(event.value) }),
    at,
  }));
}

/** The server accepts batches of up to 100 events. */
export const MAX_BATCH = 100;

export function takeBatch<T>(queue: T[]): { batch: T[]; rest: T[] } {
  return { batch: queue.slice(0, MAX_BATCH), rest: queue.slice(MAX_BATCH) };
}
