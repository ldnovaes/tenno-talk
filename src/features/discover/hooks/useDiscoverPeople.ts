import { useInfiniteQuery } from "@tanstack/react-query";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { discoverService, type DiscoverFilters } from "@/services/discoverService";

/** Kept under the "profiles" key so follow toggles patch these cards too. */
export function useDiscoverPeople(filters: DiscoverFilters) {
  return useInfiniteQuery({
    queryKey: [...profileKeys.all, "discover", filters.nativeLanguage ?? "any"],
    queryFn: ({ pageParam }) => discoverService.getPeople(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
