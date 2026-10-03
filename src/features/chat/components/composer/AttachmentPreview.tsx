import { FileText, Film, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MediaInput } from "@/services/chatService";

export function AttachmentPreview({
  media,
  onRemove,
}: {
  media: MediaInput[];
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (media.length === 0) return null;
  return (
    <ul className="flex gap-2 overflow-x-auto px-1 pb-2">
      {media.map((item, index) => (
        <li key={item.url} className="relative shrink-0">
          {item.kind === "image" ? (
            <img src={item.url} alt={item.fileName} className="size-16 rounded-lg object-cover" />
          ) : (
            <span className="grid size-16 place-items-center rounded-lg bg-muted text-muted-foreground">
              {item.kind === "video" ? (
                <Film className="size-6" aria-hidden />
              ) : (
                <FileText className="size-6" aria-hidden />
              )}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={t("chat.composer.removeAttachment")}
            className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
