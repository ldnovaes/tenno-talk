import { FileText, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { MediaAttachment } from "@/types/media";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageGrid({ media }: { media: MediaAttachment[] }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn("grid gap-0.5 overflow-hidden rounded-xl", media.length > 1 && "grid-cols-2")}
    >
      {media.slice(0, 4).map((image) => (
        <a
          key={image.id}
          href={image.url}
          target="_blank"
          rel="noreferrer"
          aria-label={t("chat.message.openImage")}
        >
          <img
            src={image.thumbnailUrl ?? image.url}
            alt={image.alt ?? ""}
            loading="lazy"
            decoding="async"
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            className={cn(
              "block w-full bg-muted object-cover",
              media.length > 1 ? "aspect-square" : "max-h-[420px]",
            )}
          />
        </a>
      ))}
    </div>
  );
}

export function VideoPlayer({ media }: { media: MediaAttachment }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        src={media.url}
        controls
        preload="metadata"
        playsInline
        className="block max-h-[420px] w-full"
      />
      {media.durationMs === null && (
        <Play
          className="pointer-events-none absolute start-2 top-2 size-4 text-white/80"
          aria-hidden
        />
      )}
    </div>
  );
}

export function FileCard({ media, fileName }: { media: MediaAttachment; fileName: string }) {
  return (
    <a
      href={media.url}
      download={fileName}
      className="flex items-center gap-3 rounded-xl bg-foreground/5 p-2 pe-3"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
        <FileText className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{fileName}</span>
        <span className="block text-xs opacity-70">{formatBytes(media.sizeBytes)}</span>
      </span>
    </a>
  );
}
