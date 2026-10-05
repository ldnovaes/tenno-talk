import { Skeleton } from "@/components/ui/skeleton";

/** Loading rows shaped like the app's list items: avatar, title and one line of text. */
export function AvatarListSkeleton() {
  return (
    <div className="space-y-1 px-2" aria-busy="true">
      {["a", "b", "c", "d", "e", "f"].map((key) => (
        <div key={key} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
