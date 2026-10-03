export type MediaKind = "image" | "video" | "audio" | "file";

export interface MediaAttachment {
  id: string;
  kind: MediaKind;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  mimeType: string;
  sizeBytes: number;
  alt: string | null;
}
