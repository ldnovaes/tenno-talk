import { useInfiniteQuery } from "@tanstack/react-query";

import { chatService } from "@/services/chatService";

import { chatKeys } from "../lib/queryKeys";

/** Messages paginated backwards: page 0 is the newest (PLAN.md §13.5). */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: ({ pageParam }) => chatService.getMessages(conversationId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Realtime keeps it fresh; avoid refetching (and losing scroll position) on remount.
    staleTime: Infinity,
  });
}
