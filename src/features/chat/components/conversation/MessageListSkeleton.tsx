import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROWS = [
  { key: "a", own: false, width: "w-48" },
  { key: "b", own: true, width: "w-64" },
  { key: "c", own: false, width: "w-40" },
  { key: "d", own: true, width: "w-56" },
  { key: "e", own: false, width: "w-72" },
];

export function MessageListSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 p-4" aria-busy="true">
      {ROWS.map((row) => (
        <Skeleton
          key={row.key}
          className={cn(
            "h-10 rounded-2xl",
            row.width,
            row.own ? "self-end bg-bubble-out" : "self-start bg-bubble-in",
          )}
        />
      ))}
    </div>
  );
}
