import { Skeleton } from "@/components/ui/skeleton";

export function FeedPostSkeleton() {
  return (
    <div className="space-y-3 pb-4" aria-busy="true">
      <div className="flex items-center gap-3 px-4 pt-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="aspect-[4/5] w-full rounded-none md:rounded-xl" />
      <Skeleton className="mx-4 h-4 w-2/3" />
    </div>
  );
}
