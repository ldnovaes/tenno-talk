import { Film, ImagePlus, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import type { MediaInput } from "@/services/chatService";

const MAX_ITEMS = 10;

export function MediaPicker({
  media,
  onAdd,
  onRemove,
}: {
  media: MediaInput[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        aria-label={t("feed.createPost.pick")}
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []).slice(0, MAX_ITEMS - media.length));
          event.target.value = "";
        }}
      />
      <div className="grid grid-cols-3 gap-2">
        {media.map((item, index) => (
          <div
            key={item.url}
            className="relative aspect-square overflow-hidden rounded-xl bg-muted"
          >
            {item.kind === "image" ? (
              <img src={item.url} alt={item.fileName} className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-muted-foreground">
                <Film className="size-8" aria-hidden />
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={t("feed.createPost.remove")}
              className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {media.length < MAX_ITEMS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <ImagePlus className="size-7" aria-hidden />
            <span className="px-2 text-center text-xs">{t("feed.createPost.pick")}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("feed.createPost.pickHint")}</p>
    </div>
  );
}
