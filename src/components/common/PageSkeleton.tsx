import { Skeleton } from "@/components/ui/skeleton";

/** Generic Suspense fallback for lazy routes. */
export function PageSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-4 p-4">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
