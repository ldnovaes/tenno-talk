import type { MediaAttachment } from "@/types/media";
import type { MediaInput } from "@/services/chatService";

import { upload } from "./httpClient";

/** Client media is a blob:/data: URL until uploaded; fetch() reads both back as a Blob. */
async function blobOf(url: string): Promise<Blob> {
  const response = await fetch(url);
  return response.blob();
}

export async function uploadBlobUrl(
  url: string,
  fileName: string,
  onProgress?: (fraction: number) => void,
  accountId?: string,
): Promise<MediaAttachment> {
  return upload<MediaAttachment>("/api/media", await blobOf(url), fileName, onProgress, accountId);
}

/** Uploads every item in order; progress is the share of bytes sent across all of them. */
export async function uploadMedia(
  media: MediaInput[],
  onProgress?: (fraction: number) => void,
  accountId?: string,
): Promise<MediaAttachment[]> {
  const total = media.reduce((sum, item) => sum + Math.max(item.sizeBytes, 1), 0);
  let done = 0;
  const uploaded: MediaAttachment[] = [];
  for (const item of media) {
    const size = Math.max(item.sizeBytes, 1);
    uploaded.push(
      await uploadBlobUrl(
        item.url,
        item.fileName,
        (fraction) => onProgress?.((done + fraction * size) / total),
        accountId,
      ),
    );
    done += size;
    onProgress?.(done / total);
  }
  return uploaded;
}

/** Avatars come from the onboarding/profile forms as data URLs; server URLs are kept. */
export async function resolveAvatarUrl(avatarUrl: string | null): Promise<string | null> {
  if (avatarUrl === null) return null;
  if (!avatarUrl.startsWith("data:") && !avatarUrl.startsWith("blob:")) return avatarUrl;
  return (await uploadBlobUrl(avatarUrl, "avatar.jpg")).url;
}
