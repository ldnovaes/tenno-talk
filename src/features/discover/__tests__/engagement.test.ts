import { describe, expect, it } from "vitest";

import {
  initialViewing,
  MAX_BATCH,
  MAX_DWELL_MS,
  takeBatch,
  toDiscoverEvents,
  view,
} from "../lib/engagement";

describe("view", () => {
  it("counts one impression per post and reports the visible time when it leaves", () => {
    const first = view(initialViewing, "a", 1_000);
    expect(first.events).toEqual([{ kind: "impression", postId: "a" }]);

    const second = view(first.state, "b", 4_500);
    expect(second.events).toEqual([
      { kind: "dwell", postId: "a", value: 3_500 },
      { kind: "impression", postId: "b" },
    ]);

    const back = view(second.state, "a", 5_000);
    expect(back.events).toEqual([{ kind: "dwell", postId: "b", value: 500 }]); // no second impression
    expect(back.state.active).toEqual({ postId: "a", since: 5_000 });
  });

  it("closes the active post when nothing is on screen", () => {
    const watching = view(initialViewing, "a", 0).state;
    const hidden = view(watching, null, 2_000);
    expect(hidden.events).toEqual([{ kind: "dwell", postId: "a", value: 2_000 }]);
    expect(hidden.state.active).toBeNull();
    expect(view(hidden.state, null, 9_000).events).toEqual([]);
  });

  it("ignores the same post again and keeps the original start", () => {
    const watching = view(initialViewing, "a", 0).state;
    const again = view(watching, "a", 9_000);
    expect(again.events).toEqual([]);
    expect(again.state).toBe(watching);
  });

  it("caps visible time and never reports negative time", () => {
    const watching = view(initialViewing, "a", 0).state;
    expect(view(watching, null, 99 * 60_000).events[0]?.value).toBe(MAX_DWELL_MS);
    expect(view(view(initialViewing, "b", 5_000).state, null, 1_000).events[0]?.value).toBe(0);
  });
});

describe("toDiscoverEvents", () => {
  it("stamps ids and time, and rounds values", () => {
    let n = 0;
    const events = toDiscoverEvents(
      [
        { kind: "dwell", postId: "a", value: 1_234.6 },
        { kind: "share", postId: "b" },
      ],
      Date.parse("2026-10-05T12:00:00Z"),
      () => `id-${++n}`,
    );
    expect(events).toEqual([
      {
        clientId: "id-1",
        postId: "a",
        kind: "dwell",
        value: 1_235,
        at: "2026-10-05T12:00:00.000Z",
      },
      { clientId: "id-2", postId: "b", kind: "share", at: "2026-10-05T12:00:00.000Z" },
    ]);
  });
});

describe("takeBatch", () => {
  it("splits at the server batch limit", () => {
    const queue = Array.from({ length: MAX_BATCH + 7 }, (_, index) => index);
    const { batch, rest } = takeBatch(queue);
    expect(batch).toHaveLength(MAX_BATCH);
    expect(rest).toEqual(queue.slice(MAX_BATCH));
    expect(takeBatch([])).toEqual({ batch: [], rest: [] });
  });
});
