export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => ["chat", "conversations"] as const,
  conversation: (id: string) => ["chat", "conversation", id] as const,
  messages: (conversationId: string) => ["chat", "messages", conversationId] as const,
  people: (query: string) => ["profiles", "search", query] as const,
};
