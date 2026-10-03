import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { MediaAttachment } from "@/types/media";

function Slide({ media }: { media: MediaAttachment }) {
  if (media.kind === "video") {
    return (
      <video
        src={media.url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
      />
    );
  }
  return (
    <img
      src={media.url}
      alt={media.alt ?? ""}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="h-full w-full object-cover"
    />
  );
}

/** Swipeable media with dots; arrows on pointer devices (PLAN.md §9.7). */
export function MediaCarousel({
  media,
  overlay,
}: {
  media: MediaAttachment[];
  overlay?: ReactNode;
}) {
  const { t } = useTranslation();
  const [viewport, api] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);
  const onSelect = useCallback(() => setSelected(api?.selectedScrollSnap() ?? 0), [api]);

  useEffect(() => {
    if (!api) return;
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <div className="group/carousel relative aspect-[4/5] w-full overflow-hidden bg-muted">
      <div ref={viewport} className="h-full overflow-hidden">
        <div className="flex h-full">
          {media.map((item, index) => (
            <div
              key={item.id}
              className="h-full min-w-0 flex-[0_0_100%]"
              role="group"
              aria-roledescription="slide"
              aria-label={t("feed.slide", { index: index + 1, count: media.length })}
            >
              <Slide media={item} />
            </div>
          ))}
        </div>
      </div>
      {overlay}
      {media.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => api?.scrollPrev()}
            disabled={selected === 0}
            aria-label={t("feed.previous")}
            className="absolute start-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 opacity-0 shadow transition-opacity group-hover/carousel:opacity-100 disabled:hidden md:grid"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => api?.scrollNext()}
            disabled={selected === media.length - 1}
            aria-label={t("feed.next")}
            className="absolute end-2 top-1/2 hidden size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 opacity-0 shadow transition-opacity group-hover/carousel:opacity-100 disabled:hidden md:grid"
          >
            <ChevronRight className="size-5 rtl:rotate-180" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden>
            {media.map((item, index) => (
              <span
                key={item.id}
                className={cn(
                  "size-1.5 rounded-full bg-white/60 transition-all",
                  index === selected && "w-3 bg-white",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
