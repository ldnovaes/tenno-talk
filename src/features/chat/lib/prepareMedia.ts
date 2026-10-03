import { fileToResizedDataUrl } from "@/lib/images";
import type { MediaInput } from "@/services/chatService";

function videoMetadata(
  url: string,
): Promise<{ width: number | null; height: number | null; durationMs: number | null }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = () =>
      resolve({
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null,
      });
    video.onloadedmetadata = done;
    video.onerror = done;
    window.setTimeout(done, 3000);
    video.src = url;
  });
}

/** Turns picked files into send-ready media (no size limit by product decision, PLAN.md §34). */
export async function prepareMedia(file: File): Promise<MediaInput> {
  if (file.type.startsWith("image/")) {
    const image = await fileToResizedDataUrl(file);
    return {
      kind: "image",
      url: image.url,
      mimeType: file.type,
      sizeBytes: file.size,
      width: image.width,
      height: image.height,
      durationMs: null,
      fileName: file.name,
    };
  }
  const url = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    const meta = await videoMetadata(url);
    return {
      kind: "video",
      url,
      mimeType: file.type,
      sizeBytes: file.size,
      ...meta,
      fileName: file.name,
    };
  }
  return {
    kind: "file",
    url,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    width: null,
    height: null,
    durationMs: null,
    fileName: file.name,
  };
}
