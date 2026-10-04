import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { Page } from "@/types/api";
import type { Conversation } from "@/types/conversation";
import type { ContentTranslation, DeliveryStatus, Message } from "@/types/message";

import { chatKeys } from "./queryKeys";

/**
 * Single write path for messages in the query cache (PLAN.md §13.2).
 * Optimistic sends, HTTP responses, realtime echoes and refetches all go
 * through these pure functions, so the same message never appears twice.
 */
export type MessagesData = InfiniteData<Page<Message>, unknown>;

const STATUS_RANK: Record<DeliveryStatus, number> = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function compareMessages(a: Message, b: Message): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function matches(item: Message, message: Pick<Message, "id" | "clientId">): boolean {
  return (
    item.id === message.id || (message.clientId !== null && item.clientId === message.clientId)
  );
}

/** Never downgrade ticks or translations because of an out-of-order event. */
export function mergeMessage(current: Message, incoming: Message): Message {
  if (incoming.id.startsWith("tmp_") && !current.id.startsWith("tmp_")) return current;
  const keepStatus =
    incoming.deliveryStatus !== "failed" &&
    current.deliveryStatus !== "failed" &&
    STATUS_RANK[current.deliveryStatus] > STATUS_RANK[incoming.deliveryStatus];
  const keepTranslation =
    current.translation !== null &&
    incoming.translation !== null &&
    current.translation.targetLanguage === incoming.translation.targetLanguage &&
    current.translation.version > incoming.translation.version;
  return {
    ...incoming,
    deliveryStatus: keepStatus ? current.deliveryStatus : incoming.deliveryStatus,
    translation: keepTranslation ? current.translation : incoming.translation,
  };
}

export function upsertInPages(data: MessagesData, message: Message): MessagesData {
  for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex++) {
    const page = data.pages[pageIndex];
    if (!page) continue;
    const itemIndex = page.items.findIndex((item) => matches(item, message));
    if (itemIndex === -1) continue;
    const current = page.items[itemIndex];
    if (!current) continue;
    const items = [...page.items];
    items[itemIndex] = mergeMessage(current, message);
    if (current.createdAt !== message.createdAt) items.sort(compareMessages);
    const pages = [...data.pages];
    pages[pageIndex] = { ...page, items };
    return { ...data, pages };
  }
  const [newest, ...rest] = data.pages;
  if (!newest) return { ...data, pages: [{ items: [message], nextCursor: null }] };
  return {
    ...data,
    pages: [{ ...newest, items: [...newest.items, message].sort(compareMessages) }, ...rest],
  };
}

export function patchInPages(
  data: MessagesData,
  match: Pick<Message, "id" | "clientId">,
  patch: (message: Message) => Message,
): MessagesData {
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => matches(item, match))) return page;
    changed = true;
    return {
      ...page,
      items: page.items.map((item) => (matches(item, match) ? patch(item) : item)),
    };
  });
  return changed ? { ...data, pages } : data;
}

export function removeFromPages(
  data: MessagesData,
  match: Pick<Message, "id" | "clientId">,
): MessagesData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => !matches(item, match)),
    })),
  };
}

/** Applies a translation event: originals are never touched; older versions are ignored. */
export function applyTranslation(
  data: MessagesData,
  messageId: string,
  translation: ContentTranslation,
): MessagesData {
  return patchInPages(data, { id: messageId, clientId: null }, (message) => {
    const current = message.translation;
    if (
      current &&
      current.targetLanguage === translation.targetLanguage &&
      current.version > translation.version
    ) {
      return message;
    }
    return { ...message, translation };
  });
}

/** Upgrades the viewer's own messages up to a cursor (delivered/read receipts). */
export function applyReceipt(
  data: MessagesData,
  viewerId: string,
  upToMessageId: string,
  status: "delivered" | "read",
): MessagesData {
  const all = data.pages.flatMap((page) => page.items);
  const cursor = all.find((message) => message.id === upToMessageId);
  if (!cursor) return data;
  let changed = false;
  const pages = data.pages.map((page) => ({
    ...page,
    items: page.items.map((message) => {
      if (message.senderId !== viewerId) return message;
      if (message.deliveryStatus === "sending" || message.deliveryStatus === "failed")
        return message;
      if (compareMessages(message, cursor) > 0) return message;
      if (STATUS_RANK[message.deliveryStatus] >= STATUS_RANK[status]) return message;
      changed = true;
      return { ...message, deliveryStatus: status };
    }),
  }));
  return changed ? { ...data, pages } : data;
}

/** Chronological list across pages (page 0 is the newest). */
export function flattenMessages(data: MessagesData | undefined): Message[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.items);
}

export function findMessage(
  data: MessagesData | undefined,
  messageId: string,
): Message | undefined {
  return data?.pages.flatMap((page) => page.items).find((message) => message.id === messageId);
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

/** Moves the conversation to the top with its new last message. */
export function withConversationPreview(
  list: Conversation[],
  message: Message,
  options: { incrementUnread: boolean },
): Conversation[] {
  const index = list.findIndex((conversation) => conversation.id === message.conversationId);
  const current = list[index];
  if (!current) return list;
  const isSameAsLast = current.lastMessage !== null && matches(current.lastMessage, message);
  const isNewer =
    current.lastMessage === null || compareMessages(current.lastMessage, message) <= 0;
  if (!isSameAsLast && !isNewer) return list;
  const next = [...list];
  next[index] = {
    ...current,
    lastMessage:
      isSameAsLast && current.lastMessage ? mergeMessage(current.lastMessage, message) : message,
    updatedAt: message.createdAt > current.updatedAt ? message.createdAt : current.updatedAt,
    unreadCount: current.unreadCount + (options.incrementUnread && !isSameAsLast ? 1 : 0),
  };
  return sortConversations(next);
}

export function withUnreadCount(list: Conversation[], conversationId: string, unreadCount: number) {
  return list.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, unreadCount } : conversation,
  );
}

// ---- QueryClient wrappers -------------------------------------------------

const pendingRefetch = new WeakMap<QueryClient, Set<string>>();

/**
 * A server event that arrives while the conversation is still loading is overwritten by the
 * response in flight (fetched before the event). React Query does not cancel a first load on
 * invalidation, so wait for it to settle and fetch once more. Several events share one refetch.
 */
export function refetchIfLoading(queryClient: QueryClient, conversationId: string): void {
  const key = chatKeys.messages(conversationId);
  const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
  if (!query || query.state.fetchStatus !== "fetching") return;
  const pending = pendingRefetch.get(queryClient) ?? new Set<string>();
  pendingRefetch.set(queryClient, pending);
  if (pending.has(query.queryHash)) return;
  pending.add(query.queryHash);
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.query !== query || query.state.fetchStatus !== "idle") return;
    unsubscribe();
    pending.delete(query.queryHash);
    void queryClient.invalidateQueries({ queryKey: key, exact: true });
  });
}

export function upsertMessage(
  queryClient: QueryClient,
  message: Message,
  options: { incrementUnread?: boolean } = {},
): void {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(message.conversationId), (data) =>
    data ? upsertInPages(data, message) : data,
  );
  const conversations = queryClient.getQueryData<Conversation[]>(chatKeys.conversations());
  if (conversations && !conversations.some((c) => c.id === message.conversationId)) {
    void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    return;
  }
  queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
    list
      ? withConversationPreview(list, message, {
          incrementUnread: options.incrementUnread ?? false,
        })
      : list,
  );
}

export function patchMessage(
  queryClient: QueryClient,
  conversationId: string,
  match: Pick<Message, "id" | "clientId">,
  patch: (message: Message) => Message,
): void {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data ? patchInPages(data, match, patch) : data,
  );
  queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
    list?.map((conversation) =>
      conversation.id === conversationId &&
      conversation.lastMessage &&
      matches(conversation.lastMessage, match)
        ? { ...conversation, lastMessage: patch(conversation.lastMessage) }
        : conversation,
    ),
  );
}

export function removeMessage(
  queryClient: QueryClient,
  conversationId: string,
  match: Pick<Message, "id" | "clientId">,
): void {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data ? removeFromPages(data, match) : data,
  );
}

export function setTranslation(
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  translation: ContentTranslation,
): void {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data ? applyTranslation(data, messageId, translation) : data,
  );
  queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
    list?.map((conversation) => {
      const last = conversation.lastMessage;
      if (conversation.id !== conversationId || !last || last.id !== messageId) return conversation;
      if (last.translation && last.translation.version > translation.version) return conversation;
      return { ...conversation, lastMessage: { ...last, translation } };
    }),
  );
}

export function setReceipt(
  queryClient: QueryClient,
  conversationId: string,
  viewerId: string,
  upToMessageId: string,
  status: "delivered" | "read",
): void {
  queryClient.setQueryData<MessagesData>(chatKeys.messages(conversationId), (data) =>
    data ? applyReceipt(data, viewerId, upToMessageId, status) : data,
  );
  void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
}

export function setConversationUnread(
  queryClient: QueryClient,
  conversationId: string,
  count: number,
): void {
  queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
    list ? withUnreadCount(list, conversationId, count) : list,
  );
}
