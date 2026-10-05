import { useInfiniteQuery } from "@tanstack/react-query";

import { feedKeys } from "@/features/feed/lib/queryKeys";
import { discoverService } from "@/services/discoverService";

/** Ranked Discover pages; the cursor belongs to a server session, so pages never repeat (PLAN.md §37.6). */
export function useDiscoverFeed() {
  return useInfiniteQuery({
    queryKey: feedKeys.discover(),
    queryFn: ({ pageParam }) => discoverService.getPosts(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    // A new session on every visit would reshuffle what the viewer is scrolling.
    staleTime: Number.POSITIVE_INFINITY,
  });
}
