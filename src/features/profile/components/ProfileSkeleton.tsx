import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 px-5 pt-20" aria-busy="true">
      <Skeleton className="size-24 rounded-full md:size-28" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-64" />
      <div className="grid w-full grid-cols-3 gap-1 pt-6">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <Skeleton key={key} className="aspect-square rounded-md" />
        ))}
      </div>
    </div>
  );
}
