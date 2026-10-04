import type { Message } from "@/types/message";
import type { PendingSend } from "./store";

/** Blob URLs belong to this page; IndexedDB stores the actual bytes, never a reusable URL. */
export function pendingPreview(entry: PendingSend): { message: Message; release: () => void } {
  const urls = entry.blobs.map((blob) => (blob ? URL.createObjectURL(blob) : null));
  const message = structuredClone(entry.message);
  const content = message.content;
  const media =
    content.type === "image"
      ? content.media
      : content.type === "video" || content.type === "file"
        ? [content.media]
        : [];
  media.forEach((item, index) => {
    const url = urls[index];
    if (url) {
      item.url = url;
      if (item.kind === "image") item.thumbnailUrl = url;
    }
  });
  return {
    message,
    release: () =>
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      }),
  };
}
