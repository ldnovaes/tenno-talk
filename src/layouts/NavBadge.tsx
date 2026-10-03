import { cn } from "@/lib/utils";

/** Unread counter attached to a navigation icon. */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -end-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-unread px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
