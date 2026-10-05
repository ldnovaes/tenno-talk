import { useEffect, useState, type RefObject } from "react";

/** Visible share of a slide that makes it the one being watched. */
export const ACTIVE_RATIO = 0.6;

/**
 * The post id of the slide mostly on screen inside {@code container}. Slides mark themselves with
 * {@code data-post-id}; {@code ids} re-observes when pages are added.
 */
export function useActiveSlide(
  container: RefObject<HTMLElement | null>,
  ids: readonly string[],
): string | null {
  const [active, setActive] = useState<string | null>(null);
  const signature = ids.join(",");

  useEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset["postId"];
          if (id && entry.intersectionRatio >= ACTIVE_RATIO) setActive(id);
        }
      },
      { root, threshold: [ACTIVE_RATIO] },
    );
    root
      .querySelectorAll<HTMLElement>("[data-post-id]")
      .forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [container, signature]);

  return active;
}
