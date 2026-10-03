import type { Message } from "@/types/message";

import { mediaLabelOf, originalOf } from "./messageText";

export interface PreviewLabels {
  you: (text: string) => string;
  media: Record<"photo" | "video" | "audio" | "file", string>;
}

/** Text shown for a received message: the translation when ready, else the original. */
export function displayTextFor(message: Message, viewerId: string): string | null {
  const original = originalOf(message);
  if (!original) return null;
  const translation = message.translation;
  if (message.senderId !== viewerId && translation?.status === "translated" && translation.text) {
    return translation.text;
  }
  return original.text;
}

/** Conversation list preview (PLAN.md §9.3). */
export function previewText(message: Message, viewerId: string, labels: PreviewLabels): string {
  const text = displayTextFor(message, viewerId);
  const media = mediaLabelOf(message);
  const body =
    text && media
      ? `${labels.media[media]} · ${text}`
      : (text ?? (media ? labels.media[media] : ""));
  return message.senderId === viewerId ? labels.you(body) : body;
}
