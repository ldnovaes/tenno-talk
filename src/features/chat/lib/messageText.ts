import type { Message, OriginalText } from "@/types/message";

/** Text authored by the sender (message body or media caption). */
export function originalOf(message: Pick<Message, "content">): OriginalText | null {
  const content = message.content;
  switch (content.type) {
    case "text":
    case "story_reply":
      return content.body;
    case "image":
    case "video":
      return content.caption;
    case "audio":
    case "file":
      return null;
  }
}

export type MediaLabel = "photo" | "video" | "audio" | "file" | null;

export function mediaLabelOf(message: Pick<Message, "content">): MediaLabel {
  switch (message.content.type) {
    case "image":
      return "photo";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "file":
      return "file";
    default:
      return null;
  }
}
