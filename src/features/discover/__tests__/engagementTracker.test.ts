import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEngagementTracker } from "@/features/discover/hooks/useEngagementTracker";
import { MAX_DWELL_MS } from "@/features/discover/lib/engagement";
import { discoverService } from "@/services/discoverService";
import type { DiscoverEvent } from "@/types/discover";

/** What Discover reports while someone scrolls (PLAN.md §37.7): the signals the ranking learns from. */
let sent: { events: DiscoverEvent[]; keepalive: boolean }[];
let track: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse("2026-10-05T12:00:00.000Z") });
  sent = [];
  track = vi.spyOn(discoverService, "trackEvents").mockImplementation((events, options) => {
    sent.push({ events, keepalive: options?.keepalive ?? false });
    return Promise.resolve();
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const summary = () =>
  sent.flatMap((call) =>
    call.events.map((e) => `${e.kind}:${e.postId}${e.value !== undefined ? `:${e.value}` : ""}`),
  );

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useEngagementTracker", () => {
  it("one impression per post, dwell when leaving it, sent every 5 s", () => {
    const { result } = renderHook(() => useEngagementTracker());
    act(() => result.current.setActive("p1"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.setActive("p2"));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.setActive("p1"));
    expect(track).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(summary()).toEqual(["impression:p1", "dwell:p1:3000", "impression:p2", "dwell:p2:1000"]);
  });

  it("explicit actions go with the rest", () => {
    const { result } = renderHook(() => useEngagementTracker());
    act(() => result.current.record("share", "p1"));
    act(() => result.current.record("profile_open", "p1"));
    act(() => vi.advanceTimersByTime(5000));
    expect(summary()).toEqual(["share:p1", "profile_open:p1"]);
  });

  it("hiding the tab ends the dwell and sends it so it survives the page; coming back resumes", () => {
    const { result } = renderHook(() => useEngagementTracker());
    act(() => result.current.setActive("p1"));
    act(() => vi.advanceTimersByTime(2000));
    act(() => setVisibility("hidden"));
    expect(sent.at(-1)?.keepalive).toBe(true);
    expect(summary()).toContain("dwell:p1:2000");
    act(() => vi.advanceTimersByTime(60_000));
    act(() => setVisibility("visible"));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.setActive(null));
    act(() => vi.advanceTimersByTime(5000));
    expect(summary().filter((e) => e.startsWith("dwell:p1"))).toEqual([
      "dwell:p1:2000",
      "dwell:p1:1000",
    ]);
    expect(summary().filter((e) => e === "impression:p1")).toHaveLength(1);
  });

  it("a slide left open for hours counts at most 10 minutes", () => {
    const { result } = renderHook(() => useEngagementTracker());
    act(() => result.current.setActive("p1"));
    act(() => vi.advanceTimersByTime(3 * 60 * 60_000 - 5000));
    act(() => result.current.setActive(null));
    act(() => vi.advanceTimersByTime(5000));
    expect(summary()).toContain(`dwell:p1:${MAX_DWELL_MS}`);
  });

  it("events that fail to send are sent with the next batch", async () => {
    track.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useEngagementTracker());
    act(() => result.current.record("share", "p1"));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(sent).toHaveLength(0);
    act(() => result.current.record("share", "p2"));
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(summary()).toEqual(["share:p1", "share:p2"]);
  });

  it("leaving Discover sends what is pending", () => {
    const { result, unmount } = renderHook(() => useEngagementTracker());
    act(() => result.current.setActive("p1"));
    act(() => vi.advanceTimersByTime(1500));
    unmount();
    expect(summary()).toEqual(["impression:p1", "dwell:p1:1500"]);
  });

  it("every event carries a unique id for the server's deduplication", () => {
    const { result } = renderHook(() => useEngagementTracker());
    for (const id of ["p1", "p2", "p3"]) act(() => result.current.setActive(id));
    act(() => vi.advanceTimersByTime(5000));
    const ids = sent.flatMap((call) => call.events.map((e) => e.clientId));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
