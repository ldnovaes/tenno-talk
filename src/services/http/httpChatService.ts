import type { ChatService } from "@/services/chatService";
import type { Page } from "@/types/api";
import type { Conversation } from "@/types/conversation";
import type { Message } from "@/types/message";

import { http } from "./httpClient";
import { uploadMedia } from "./media";

const conversation = (id: string) => `/api/conversations/${encodeURIComponent(id)}`;
const message = (id: string) => `/api/messages/${encodeURIComponent(id)}`;

/** A retried send reuses its clientId; this keeps it from uploading the same files twice. */
const uploadedByClientId = new Map<string, string[]>();

export const httpChatService: ChatService = {
  getConversations: () => http<Conversation[]>("GET", "/api/conversations"),

  getConversation: (id) => http<Conversation>("GET", conversation(id)),

  getMessages: (id, cursor) =>
    http<Page<Message>>("GET", `${conversation(id)}/messages`, { query: { cursor } }),

  async sendMessage(input) {
    let mediaIds = uploadedByClientId.get(input.clientId);
    if (!mediaIds) {
      mediaIds = (await uploadMedia(input.media)).map((media) => media.id);
      uploadedByClientId.set(input.clientId, mediaIds);
    }
    const sent = await http<Message>("POST", `${conversation(input.conversationId)}/messages`, {
      body: { clientId: input.clientId, text: input.text, mediaIds, replyToId: input.replyToId },
    });
    uploadedByClientId.delete(input.clientId);
    return sent;
  },

  acknowledge: (id, messageIds) =>
    http<void>("POST", `${conversation(id)}/delivered`, { body: { messageIds } }),

  markAsRead: (id, messageId) =>
    http<void>("POST", `${conversation(id)}/read`, { body: { messageId } }),

  react: (messageId, emoji) =>
    http<Message>("POST", `${message(messageId)}/reactions`, { body: { emoji } }),

  forward: (messageId, conversationIds) =>
    http<void>("POST", `${message(messageId)}/forward`, { body: { conversationIds } }),

  setMuted: (id, muted) =>
    http<Conversation>("PUT", `${conversation(id)}/mute`, { body: { muted } }),

  getOrCreateDirectConversation: (userId) =>
    http<Conversation>("POST", "/api/conversations/direct", { body: { userId } }),

  createGroup: (input) => http<Conversation>("POST", "/api/conversations/groups", { body: input }),
};
