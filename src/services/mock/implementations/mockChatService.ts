import { AppError } from "@/lib/errors";
import type { ChatService, MediaInput, SendMessageInput } from "@/services/chatService";
import type { MediaAttachment } from "@/types/media";

import { maybeAutoRespond } from "../autoResponder";
import { mockDb } from "../db";
import { publish } from "../events";
import { mockRequest } from "../latency";
import { blockedEitherWay, requireDirectSend } from "../privacy";
import { projectConversation, projectMessage, sortedMessages } from "../projections";
import type {
  ConversationRecord,
  MessageContentRecord,
  MessageRecord,
  MockDatabase,
} from "../schema";
import { requireViewerId } from "../session";
import { scheduleTranslations } from "../translationPipeline";

const PAGE_SIZE = 30;
const FAR_FUTURE = "9999-12-31T23:59:59.000Z";

function memberConversation(
  db: MockDatabase,
  conversationId: string,
  viewerId: string,
): ConversationRecord {
  const conversation = db.conversations[conversationId];
  if (!conversation) throw new AppError("not_found", "Conversation not found.");
  if (!conversation.memberIds.includes(viewerId)) {
    throw new AppError("forbidden", "You are not a member of this conversation.");
  }
  return conversation;
}

function toAttachment(input: MediaInput): MediaAttachment {
  return {
    id: `media_${crypto.randomUUID()}`,
    kind: input.kind,
    url: input.url,
    thumbnailUrl: input.kind === "image" ? input.url : null,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    alt: null,
  };
}

function buildContent(input: SendMessageInput, language: string): MessageContentRecord {
  const text = input.text.trim();
  const body = text ? { text, language } : null;
  const images = input.media.filter((m) => m.kind === "image");
  const video = input.media.find((m) => m.kind === "video");
  const file = input.media.find((m) => m.kind === "file");
  if (images.length > 0) return { type: "image", media: images.map(toAttachment), caption: body };
  if (video) return { type: "video", media: toAttachment(video), caption: body };
  if (file) return { type: "file", media: toAttachment(file), fileName: file.fileName };
  if (!body) throw new AppError("validation", "A message can't be empty.");
  return { type: "text", body };
}

/** Called by the realtime client when a message reaches this tab (delivery ack). */
export function acknowledgeDelivery(
  viewerId: string,
  conversationId: string,
  messageId: string,
): void {
  const changed = mockDb.update((db) => {
    const conversation = db.conversations[conversationId];
    const message = db.messages[messageId];
    if (
      !conversation ||
      !message ||
      message.conversationId !== conversationId ||
      message.senderId === viewerId ||
      !conversation.memberIds.includes(viewerId)
    )
      return false;
    if (message.receipts) {
      if (!(viewerId in message.receipts) || message.receipts[viewerId]) return false;
      message.receipts[viewerId] = true;
      return true;
    }
    const current = conversation.lastDeliveredMessageId[viewerId];
    const currentAt = current ? db.messages[current]?.createdAt : undefined;
    if (currentAt && currentAt >= message.createdAt) return false;
    conversation.lastDeliveredMessageId[viewerId] = messageId;
    return true;
  });
  if (changed)
    publish({
      kind: "receipt",
      conversationId,
      userId: viewerId,
      receipt: "delivered",
      upToMessageId: messageId,
    });
}

function createMessage(
  db: MockDatabase,
  record: Omit<MessageRecord, "id" | "createdAt">,
): MessageRecord {
  const now = new Date().toISOString();
  const message: MessageRecord = { ...record, id: `msg_${crypto.randomUUID()}`, createdAt: now };
  db.messages[message.id] = message;
  const conversation = db.conversations[message.conversationId];
  if (conversation) {
    message.receipts = Object.fromEntries(
      conversation.memberIds.filter((id) => id !== message.senderId).map((id) => [id, false]),
    );
    conversation.updatedAt = now;
    conversation.lastReadMessageId[message.senderId] = message.id;
    conversation.lastDeliveredMessageId[message.senderId] = message.id;
  }
  return message;
}

function afterCreate(message: MessageRecord) {
  const notifications = mockDb.update((db) => {
    const conversation = db.conversations[message.conversationId];
    const recipients: { id: string; user: string }[] = [];
    for (const user of conversation?.memberIds ?? []) {
      const recipient = db.users[user];
      if (
        user === message.senderId ||
        !recipient?.preferences.notifications.messages ||
        recipient.blockedUserIds.includes(message.senderId) ||
        db.users[message.senderId]?.blockedUserIds.includes(user)
      )
        continue;
      if ((conversation?.mutedUntil[user] ?? "") > new Date().toISOString()) continue;
      const id = `ntf_message_${message.id}_${user}`;
      if (db.notifications[id]) continue;
      db.notifications[id] = {
        id,
        recipientId: user,
        actorId: message.senderId,
        type: "new_message",
        conversationId: message.conversationId,
        messageId: message.id,
        postId: null,
        commentId: null,
        storyId: null,
        emoji: null,
        readAt: null,
        createdAt: message.createdAt,
      };
      recipients.push({ id, user });
    }
    return recipients;
  });
  notifications.forEach(({ id, user }) =>
    publish({ kind: "notification.created", notificationId: id, recipientId: user }),
  );
  publish({
    kind: "message.created",
    conversationId: message.conversationId,
    messageId: message.id,
  });
  scheduleTranslations(message.id);
  maybeAutoRespond(message);
}

export const mockChatService: ChatService = {
  async acknowledge(conversationId, ids) {
    const viewer = requireViewerId();
    memberConversation(mockDb.read(), conversationId, viewer);
    ids.forEach((id) => acknowledgeDelivery(viewer, conversationId, id));
  },
  getConversations() {
    return mockRequest(() => {
      const viewer = requireViewerId();
      const db = mockDb.read();
      return Object.values(db.conversations)
        .filter((c) => c.memberIds.includes(viewer))
        .map((c) => projectConversation(db, c, viewer))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  },

  getConversation(conversationId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      return projectConversation(db, memberConversation(db, conversationId, viewerId), viewerId);
    });
  },

  getMessages(conversationId, cursor) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      memberConversation(db, conversationId, viewerId);
      const all = sortedMessages(db, conversationId);
      const older = cursor ? all.filter((m) => `${m.createdAt}|${m.id}` < cursor) : all;
      const items = older.slice(-PAGE_SIZE);
      const first = items[0];
      return {
        items: items.map((m) => projectMessage(db, m, viewerId)),
        nextCursor: first && older.length > items.length ? `${first.createdAt}|${first.id}` : null,
      };
    });
  },

  async sendMessage(input) {
    const viewerId = requireViewerId();
    const message = await mockRequest(() =>
      mockDb.update((db) => {
        const conversation = memberConversation(db, input.conversationId, viewerId);
        const existing = Object.values(db.messages).find(
          (m) => m.senderId === viewerId && m.clientId === input.clientId,
        );
        if (existing) return { record: existing, created: false };
        requireDirectSend(db, conversation, viewerId);
        const sender = db.users[viewerId];
        if (!sender) throw new AppError("unauthenticated", "Your session has expired.");
        if (
          input.replyToId &&
          db.messages[input.replyToId]?.conversationId !== input.conversationId
        ) {
          throw new AppError("validation", "You can only reply to a message of this conversation.");
        }
        const record = createMessage(db, {
          clientId: input.clientId,
          conversationId: input.conversationId,
          senderId: viewerId,
          content: buildContent(input, sender.nativeLanguage),
          translations: {},
          literals: {},
          replyToId: input.replyToId,
          reactions: [],
          statusOverride: null,
        });
        return { record, created: true };
      }),
    );
    if (message.created) afterCreate(message.record);
    return projectMessage(mockDb.read(), message.record, viewerId);
  },

  async markAsRead(conversationId, messageId) {
    const viewerId = requireViewerId();
    const changed = await mockRequest(() =>
      mockDb.update((db) => {
        const conversation = memberConversation(db, conversationId, viewerId);
        const message = db.messages[messageId];
        if (!message || message.conversationId !== conversationId) {
          throw new AppError("not_found", "Message not found.");
        }
        for (const notification of Object.values(db.notifications)) {
          const target = notification.messageId ? db.messages[notification.messageId] : undefined;
          if (
            notification.recipientId === viewerId &&
            notification.conversationId === conversationId &&
            target &&
            `${target.createdAt}|${target.id}` <= `${message.createdAt}|${message.id}`
          )
            notification.readAt ??= new Date().toISOString();
        }
        const current = conversation.lastReadMessageId[viewerId];
        const currentAt = current ? db.messages[current]?.createdAt : undefined;
        if (currentAt && currentAt >= message.createdAt) return false;
        conversation.lastReadMessageId[viewerId] = messageId;
        conversation.lastDeliveredMessageId[viewerId] = messageId;
        return true;
      }),
    );
    publish({ kind: "notifications.read", recipientId: viewerId });
    if (changed)
      publish({
        kind: "receipt",
        conversationId,
        userId: viewerId,
        receipt: "read",
        upToMessageId: messageId,
      });
  },

  async react(messageId, emoji) {
    const viewerId = requireViewerId();
    const result = await mockRequest(() =>
      mockDb.update((db) => {
        const message = db.messages[messageId];
        if (!message) throw new AppError("not_found", "Message not found.");
        memberConversation(db, message.conversationId, viewerId);
        const index = message.reactions.findIndex(
          (r) => r.userId === viewerId && r.emoji === emoji,
        );
        const added = index === -1;
        if (added) message.reactions.push({ userId: viewerId, emoji });
        else message.reactions.splice(index, 1);
        return { conversationId: message.conversationId, added };
      }),
    );
    publish({
      kind: "reaction",
      conversationId: result.conversationId,
      messageId,
      userId: viewerId,
      emoji,
      added: result.added,
    });
    publish({ kind: "message.updated", conversationId: result.conversationId, messageId });
    const db = mockDb.read();
    const record = db.messages[messageId];
    if (!record) throw new AppError("not_found", "Message not found.");
    return projectMessage(db, record, viewerId);
  },

  async forward(messageId, conversationIds) {
    const viewerId = requireViewerId();
    const created = await mockRequest(() =>
      mockDb.update((db) => {
        const source = db.messages[messageId];
        if (!source) throw new AppError("not_found", "Message not found.");
        memberConversation(db, source.conversationId, viewerId);
        return conversationIds.map((conversationId) => {
          const conversation = memberConversation(db, conversationId, viewerId);
          requireDirectSend(db, conversation, viewerId);
          return createMessage(db, {
            clientId: null,
            conversationId,
            senderId: viewerId,
            content: structuredClone(source.content),
            translations: {},
            literals: {},
            replyToId: null,
            reactions: [],
            statusOverride: null,
          });
        });
      }),
    );
    created.forEach(afterCreate);
  },

  setMuted(conversationId, muted) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        const conversation = memberConversation(db, conversationId, viewerId);
        conversation.mutedUntil[viewerId] = muted ? FAR_FUTURE : null;
        return projectConversation(db, conversation, viewerId);
      }),
    );
  },

  getOrCreateDirectConversation(userId) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        if (userId === viewerId) throw new AppError("validation", "You can't message yourself.");
        const target = db.users[userId];
        if (!target) throw new AppError("not_found", "User not found.");
        if (blockedEitherWay(db, viewerId, userId))
          throw new AppError("forbidden", "Messaging is unavailable.");
        const existing = Object.values(db.conversations).find(
          (c) =>
            c.kind === "direct" && c.memberIds.includes(viewerId) && c.memberIds.includes(userId),
        );
        if (existing) return projectConversation(db, existing, viewerId);
        const audience = target.preferences.privacy.whoCanMessage;
        const followsViewer = db.follows.some(
          (f) => f.followerId === userId && f.followeeId === viewerId,
        );
        if (audience === "nobody" || (audience === "followers" && !followsViewer)) {
          throw new AppError(
            "forbidden",
            "This person only accepts messages from people they follow.",
          );
        }
        const now = new Date().toISOString();
        const conversation: ConversationRecord = {
          id: `conv_${crypto.randomUUID()}`,
          kind: "direct",
          title: null,
          avatarUrl: null,
          createdBy: viewerId,
          memberIds: [viewerId, userId],
          lastReadMessageId: {},
          lastDeliveredMessageId: {},
          mutedUntil: {},
          createdAt: now,
          updatedAt: now,
        };
        db.conversations[conversation.id] = conversation;
        return projectConversation(db, conversation, viewerId);
      }),
    );
  },

  createGroup({ title, memberIds }) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        const trimmed = title.trim();
        if (!trimmed) throw new AppError("validation", "Give the group a name.");
        // Product rule (PLAN.md §34): each person creates at most one group.
        if (
          Object.values(db.conversations).some(
            (c) => c.kind === "group" && c.createdBy === viewerId,
          )
        ) {
          throw new AppError("conflict", "You can create only one group.");
        }
        const members = [...new Set([viewerId, ...memberIds])].filter((id) => db.users[id]);
        if (members.length < 3)
          throw new AppError("validation", "Add at least two people to the group.");
        const now = new Date().toISOString();
        const conversation: ConversationRecord = {
          id: `conv_${crypto.randomUUID()}`,
          kind: "group",
          title: trimmed,
          avatarUrl: null,
          createdBy: viewerId,
          memberIds: members,
          lastReadMessageId: {},
          lastDeliveredMessageId: {},
          mutedUntil: {},
          createdAt: now,
          updatedAt: now,
        };
        db.conversations[conversation.id] = conversation;
        return projectConversation(db, conversation, viewerId);
      }),
    );
  },
};
