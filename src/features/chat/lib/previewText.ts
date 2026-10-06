import { resolveMessageDisplay } from "@/features/translation/lib/resolveMessageDisplay";
import type { Message } from "@/types/message";
import type { TranslationDisplayMode } from "@/types/preferences";

import { mediaLabelOf, originalOf } from "./messageText";

export interface PreviewLabels {
  you: (text: string) => string;
  media: Record<"photo" | "video" | "audio" | "file", string>;
  /** "Reacted ❤️ to your story" / "You reacted ❤️ to their story" (PLAN.md §9.9). */
  storyReaction: { received: (emoji: string) => string; sent: (emoji: string) => string };
}

/** Text a message shows by default for this viewer and display mode (no per-message override). */
export function displayTextFor(
  message: Message,
  viewerId: string,
  mode: TranslationDisplayMode = "translation",
): string | null {
  if (message.content.type === "story_reaction") return message.content.emoji;
  const original = originalOf(message);
  if (!original) return null;
  return resolveMessageDisplay({
    original,
    translation: message.translation,
    isOwn: message.senderId === viewerId,
    mode,
    override: null,
  }).primary.text;
}

/** Conversation list preview (PLAN.md §9.3). */
export function previewText(
  message: Message,
  viewerId: string,
  labels: PreviewLabels,
  mode: TranslationDisplayMode = "translation",
): string {
  if (message.content.type === "story_reaction") {
    const { emoji } = message.content;
    return message.senderId === viewerId
      ? labels.storyReaction.sent(emoji)
      : labels.storyReaction.received(emoji);
  }
  const text = displayTextFor(message, viewerId, mode);
  const media = mediaLabelOf(message);
  const body =
    text && media
      ? `${labels.media[media]} · ${text}`
      : (text ?? (media ? labels.media[media] : ""));
  return message.senderId === viewerId ? labels.you(body) : body;
}
