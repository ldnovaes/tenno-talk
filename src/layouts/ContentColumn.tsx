import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Centered column used by Discover, Feed and Notifications (PLAN.md §6.4). */
export function ContentColumn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="h-full overflow-y-auto bg-chat-bg">
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
