import type { Conversation } from "@/types/conversation";
import type { Message } from "@/types/message";

let counter = 0;

export function makeMessage(overrides: Partial<Message> = {}): Message {
  counter += 1;
  return {
    id: `m${counter}`,
    clientId: null,
    conversationId: "c1",
    senderId: "me",
    content: { type: "text", body: { text: `hello ${counter}`, language: "pt-BR" } },
    translation: null,
    replyTo: null,
    reactions: [],
    deliveryStatus: "sent",
    createdAt: new Date(Date.UTC(2026, 9, 3, 10, 0, counter)).toISOString(),
    ...overrides,
  };
}

export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    kind: "direct",
    title: null,
    avatarUrl: null,
    createdBy: "me",
    members: [
      {
        user: { id: "me", username: "me", displayName: "Me", avatarUrl: null },
        role: "admin",
        receivingLanguage: "pt-BR",
        lastReadMessageId: null,
        isOnline: true,
        lastSeenAt: null,
      },
      {
        user: { id: "cam", username: "cam", displayName: "Cam Nguyen", avatarUrl: null },
        role: "member",
        receivingLanguage: "vi-VN",
        lastReadMessageId: null,
        isOnline: false,
        lastSeenAt: null,
      },
    ],
    lastMessage: null,
    unreadCount: 0,
    mutedUntil: null,
    updatedAt: "2026-10-03T09:00:00.000Z",
    ...overrides,
  };
}
