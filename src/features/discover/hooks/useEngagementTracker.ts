import { useCallback, useEffect, useRef } from "react";

import { discoverService } from "@/services/discoverService";
import type { DiscoverEvent } from "@/types/discover";

import {
  initialViewing,
  takeBatch,
  toDiscoverEvents,
  view,
  type PendingEvent,
  type ViewingState,
} from "../lib/engagement";

const FLUSH_EVERY_MS = 5_000;
/** Kept while offline; older events are dropped first (signals, not data the user would miss). */
const MAX_QUEUE = 500;

/**
 * Reports impressions, visible time and explicit actions in batches (PLAN.md §37.7). Never blocks the UI and
 * never surfaces errors: a lost signal only makes the ranking a little less personal.
 */
export function useEngagementTracker() {
  const viewing = useRef<ViewingState>(initialViewing);
  const lastActive = useRef<string | null>(null);
  const queue = useRef<DiscoverEvent[]>([]);

  const enqueue = useCallback((pending: PendingEvent[]) => {
    if (pending.length === 0) return;
    queue.current = [...queue.current, ...toDiscoverEvents(pending, Date.now())].slice(-MAX_QUEUE);
  }, []);

  const flush = useCallback((keepalive = false) => {
    const { batch, rest } = takeBatch(queue.current);
    if (batch.length === 0) return;
    queue.current = rest;
    discoverService.trackEvents(batch, { keepalive }).catch(() => {
      queue.current = [...batch, ...queue.current].slice(-MAX_QUEUE);
    });
  }, []);

  const setActive = useCallback(
    (postId: string | null) => {
      if (postId !== null) lastActive.current = postId;
      const next = view(viewing.current, postId, Date.now());
      viewing.current = next.state;
      enqueue(next.events);
    },
    [enqueue],
  );

  const record = useCallback(
    (kind: PendingEvent["kind"], postId: string) => enqueue([{ kind, postId }]),
    [enqueue],
  );

  useEffect(() => {
    const timer = window.setInterval(() => flush(), FLUSH_EVERY_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setActive(null);
        flush(true);
      } else if (lastActive.current) {
        setActive(lastActive.current);
      }
    };
    const onPageHide = () => {
      setActive(null);
      flush(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      setActive(null);
      flush();
    };
  }, [flush, setActive]);

  return { setActive, record, flush };
}
