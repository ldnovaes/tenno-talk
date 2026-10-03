import type { StoryTrayItem } from "@/types/story";

export interface StoryPosition {
  userIndex: number;
  storyIndex: number;
}

/** First unseen story of a user (or the first one if all were seen). */
export function startPosition(
  tray: readonly StoryTrayItem[],
  userId: string,
): StoryPosition | null {
  const userIndex = tray.findIndex((item) => item.user.id === userId);
  const item = tray[userIndex];
  if (!item) return null;
  const firstUnseen = item.stories.findIndex((story) => !story.viewedByMe);
  return { userIndex, storyIndex: firstUnseen === -1 ? 0 : firstUnseen };
}

/** Next story, moving to the next person after the last one; null at the very end. */
export function nextPosition(
  tray: readonly StoryTrayItem[],
  position: StoryPosition,
): StoryPosition | null {
  const item = tray[position.userIndex];
  if (!item) return null;
  if (position.storyIndex + 1 < item.stories.length)
    return { ...position, storyIndex: position.storyIndex + 1 };
  if (position.userIndex + 1 < tray.length)
    return { userIndex: position.userIndex + 1, storyIndex: 0 };
  return null;
}

/** Previous story, going back to the last story of the previous person; null at the start. */
export function previousPosition(
  tray: readonly StoryTrayItem[],
  position: StoryPosition,
): StoryPosition | null {
  if (position.storyIndex > 0) return { ...position, storyIndex: position.storyIndex - 1 };
  const previous = tray[position.userIndex - 1];
  if (!previous) return null;
  return { userIndex: position.userIndex - 1, storyIndex: previous.stories.length - 1 };
}
