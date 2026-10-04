import { useQuery } from "@tanstack/react-query";

import { acknowledgeReceived } from "@/services/realtime/deliveryAcks";
import { chatService } from "@/services/chatService";

import { chatKeys } from "../lib/queryKeys";

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: async () => {
      const conversations = await chatService.getConversations();
      conversations.forEach((conversation) => {
        if (conversation.lastMessage)
          acknowledgeReceived(conversation.id, [conversation.lastMessage.id]);
      });
      return conversations;
    },
  });
}

/** One conversation, served from the list cache when possible. */
export function useConversation(conversationId: string) {
  const list = useConversations();
  const cached = list.data?.find((conversation) => conversation.id === conversationId);
  const single = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => chatService.getConversation(conversationId),
    enabled: list.isSuccess && !cached,
  });
  return {
    data: cached ?? single.data,
    isPending: list.isPending || (!cached && single.isPending),
    error: list.error ?? single.error,
    refetch: () => (cached ? list.refetch() : single.refetch()),
  };
}
