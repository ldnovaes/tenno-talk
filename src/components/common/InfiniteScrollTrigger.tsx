import { useEffect, useRef } from "react";

/** Invisible sentinel that calls onVisible when it enters the viewport. */
export function InfiniteScrollTrigger({
  onVisible,
  disabled = false,
  rootMargin = "400px",
}: {
  onVisible: () => void;
  disabled?: boolean;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [disabled, rootMargin]);

  return <div ref={ref} aria-hidden className="h-px w-full" />;
}
