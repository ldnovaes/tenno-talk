import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { discoverService } from "@/services/discoverService";
import type { DiscoverEvent } from "@/types/discover";
import { controllableIntersection } from "@/test/intersection";
import { renderApp, signInAs } from "@/test/utils";

/** Discover reports the slide mostly on screen (≥ 60%), from the real feed (PLAN.md §37.7). */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Discover engagement", () => {
  it("only a slide at least 60% on screen counts as watched", async () => {
    const intersection = controllableIntersection();
    const events: DiscoverEvent[] = [];
    vi.spyOn(discoverService, "trackEvents").mockImplementation((batch) => {
      events.push(...batch);
      return Promise.resolve();
    });
    signInAs("usr_rafael");
    const { unmount } = renderApp("/discover");
    await waitFor(() => expect(intersection.observed().length).toBeGreaterThan(1));
    const [first, second] = intersection
      .observed()
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && !!element.dataset["postId"],
      );
    if (!first || !second) throw new Error("slides");

    act(() => intersection.show(first, 0.9));
    act(() => intersection.show(second, 0.3));
    act(() => intersection.show(second, 0.7));
    unmount();

    const kinds = events.map((event) => `${event.kind}:${event.postId}`);
    expect(kinds).toEqual([
      `impression:${first.dataset["postId"]}`,
      expect.stringMatching(`^dwell:${first.dataset["postId"]}$`),
      `impression:${second.dataset["postId"]}`,
      expect.stringMatching(`^dwell:${second.dataset["postId"]}$`),
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
