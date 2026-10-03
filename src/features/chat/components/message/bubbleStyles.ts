import type { BubblePosition } from "../../lib/groupMessages";

/** Grouped corners: the sender side tightens between consecutive bubbles. */
export function bubbleCorners(position: BubblePosition, own: boolean): string {
  if (own) {
    return {
      single: "rounded-ee-md",
      first: "rounded-ee-md",
      middle: "rounded-e-md",
      last: "rounded-e-md",
    }[position];
  }
  return {
    single: "rounded-es-md",
    first: "rounded-es-md",
    middle: "rounded-s-md",
    last: "rounded-s-md",
  }[position];
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
