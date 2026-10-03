import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStoryTimer } from "@/features/stories/components/useStoryTimer";
import {
  nextPosition,
  previousPosition,
  startPosition,
} from "@/features/stories/lib/storyNavigation";
import type { Story, StoryTrayItem } from "@/types/story";

const story = (id: string, viewedByMe = false): Story => ({
  id,
  author: { id: "u", username: "u", displayName: "U", avatarUrl: null },
  media: {
    id: `${id}m`,
    kind: "image",
    url: "",
    thumbnailUrl: null,
    width: null,
    height: null,
    durationMs: null,
    mimeType: "image/png",
    sizeBytes: 0,
    alt: null,
  },
  overlayText: null,
  overlayTranslation: null,
  createdAt: "",
  expiresAt: "",
  viewedByMe,
});

const tray: StoryTrayItem[] = [
  {
    user: { id: "a", username: "a", displayName: "A", avatarUrl: null },
    stories: [story("a1", true), story("a2")],
    hasUnseen: true,
  },
  {
    user: { id: "b", username: "b", displayName: "B", avatarUrl: null },
    stories: [story("b1", true)],
    hasUnseen: false,
  },
];

describe("story navigation", () => {
  it("starts at the first unseen story, or the first when all were seen", () => {
    expect(startPosition(tray, "a")).toEqual({ userIndex: 0, storyIndex: 1 });
    expect(startPosition(tray, "b")).toEqual({ userIndex: 1, storyIndex: 0 });
    expect(startPosition(tray, "nobody")).toBeNull();
  });

  it("moves across people and stops at both ends", () => {
    expect(nextPosition(tray, { userIndex: 0, storyIndex: 0 })).toEqual({
      userIndex: 0,
      storyIndex: 1,
    });
    expect(nextPosition(tray, { userIndex: 0, storyIndex: 1 })).toEqual({
      userIndex: 1,
      storyIndex: 0,
    });
    expect(nextPosition(tray, { userIndex: 1, storyIndex: 0 })).toBeNull();
    expect(previousPosition(tray, { userIndex: 1, storyIndex: 0 })).toEqual({
      userIndex: 0,
      storyIndex: 1,
    });
    expect(previousPosition(tray, { userIndex: 0, storyIndex: 0 })).toBeNull();
  });
});

describe("useStoryTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances, pauses and finishes", () => {
    const onDone = vi.fn();
    const { result, rerender } = renderHook(
      ({ paused }) => useStoryTimer("s1", 1000, paused, onDone),
      {
        initialProps: { paused: false },
      },
    );
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBeCloseTo(0.5, 1);
    rerender({ paused: true });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBeCloseTo(0.5, 1);
    rerender({ paused: false });
    act(() => vi.advanceTimersByTime(600));
    expect(result.current).toBe(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("restarts when the story changes", () => {
    const { result, rerender } = renderHook(({ id }) => useStoryTimer(id, 1000, false, () => {}), {
      initialProps: { id: "s1" },
    });
    act(() => vi.advanceTimersByTime(400));
    rerender({ id: "s2" });
    expect(result.current).toBe(0);
  });
});
