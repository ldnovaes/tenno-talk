import { useInfiniteQuery } from "@tanstack/react-query";

import { acknowledgeReceived } from "@/services/realtime/deliveryAcks";
import { chatService } from "@/services/chatService";

import { chatKeys } from "../lib/queryKeys";

/** Messages paginated backwards: page 0 is the newest (PLAN.md §13.5). */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async ({ pageParam }) => {
      const page = await chatService.getMessages(conversationId, pageParam);
      acknowledgeReceived(
        conversationId,
        page.items.map((m) => m.id),
      );
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Realtime keeps it fresh; avoid refetching (and losing scroll position) on remount.
    staleTime: Infinity,
  });
}
