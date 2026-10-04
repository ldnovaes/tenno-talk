import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router";
const scrollPositions = new Map<string, number>();

import { cn } from "@/lib/utils";

/** Centered column used by Discover, Feed and Notifications (PLAN.md §6.4). */
export function ContentColumn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { key } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) element.scrollTop = scrollPositions.get(key) ?? 0;
    return () => {
      if (element) {
        scrollPositions.set(key, element.scrollTop);
        if (scrollPositions.size > 100)
          scrollPositions.delete(scrollPositions.keys().next().value ?? "");
      }
    };
  }, [key]);
  return (
    <div ref={ref} className="h-full overflow-y-auto bg-chat-bg">
      <div
        className={cn(
          "mx-auto flex min-h-full w-full max-w-[640px] flex-col bg-background md:border-x",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
