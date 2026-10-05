import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  applyTranslation,
  compareMessages,
  flattenMessages,
  mergeMessage,
  patchInPages,
  refetchIfLoading,
  removeFromPages,
  removeMessage,
  patchMessage,
  setConversationUnread,
  setTranslation,
  upsertMessage,
  upsertInPages,
  withConversationPreview,
  withUnreadCount,
  type MessagesData,
} from "@/features/chat/lib/messageCache";
import { chatKeys } from "@/features/chat/lib/queryKeys";
import type { Conversation } from "@/types/conversation";
import type { ContentTranslation, DeliveryStatus } from "@/types/message";
import { caseName, cartesian } from "@/test/combinations";

import { makeConversation, makeMessage } from "@/test/factories";

function data(...pages: ReturnType<typeof makeMessage>[][]): MessagesData {
  return {
    pages: pages.map((items) => ({ items, nextCursor: null })),
    pageParams: pages.map(() => null),
  };
}

const translation = (version: number, text = `v${version}`): ContentTranslation => ({
  targetLanguage: "vi-VN",
  text,
  status: "translated",
  version,
  updatedAt: "2026-10-03T10:00:00.000Z",
});

describe("upsertInPages", () => {
  it("appends a new message to the newest page in chronological order", () => {
    const a = makeMessage();
    const b = makeMessage();
    const result = upsertInPages(data([b]), a);
    expect(result.pages[0]?.items.map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it("replaces the optimistic message by clientId (no duplicate)", () => {
    const optimistic = makeMessage({ id: "tmp_k1", clientId: "k1", deliveryStatus: "sending" });
    const server = makeMessage({ id: "srv1", clientId: "k1", deliveryStatus: "sent" });
    const result = upsertInPages(data([optimistic]), server);
    expect(flattenMessages(result)).toEqual([server]);
  });

  it("handles the realtime echo arriving before the HTTP response", () => {
    const optimistic = makeMessage({ id: "tmp_k2", clientId: "k2", deliveryStatus: "sending" });
    const echo = makeMessage({ id: "srv2", clientId: "k2", deliveryStatus: "delivered" });
    const response = { ...echo, deliveryStatus: "sent" as const };
    const afterEcho = upsertInPages(data([optimistic]), echo);
    const afterResponse = upsertInPages(afterEcho, response);
    const all = flattenMessages(afterResponse);
    expect(all).toHaveLength(1);
    // The later, lower status must not downgrade the ticks.
    expect(all[0]?.deliveryStatus).toBe("delivered");
  });

  it("finds messages in older pages", () => {
    const old = makeMessage();
    const recent = makeMessage();
    const result = upsertInPages(data([recent], [old]), {
      ...old,
      reactions: [{ emoji: "❤️", count: 1, reactedByMe: true }],
    });
    expect(result.pages[1]?.items[0]?.reactions).toHaveLength(1);
    expect(result.pages[0]).toBe(result.pages[0]);
  });

  it("keeps untouched pages by reference (memoized bubbles)", () => {
    const old = makeMessage();
    const recent = makeMessage();
    const input = data([recent], [old]);
    const result = upsertInPages(input, makeMessage());
    expect(result.pages[1]).toBe(input.pages[1]);
  });

  it("creates the first page when the cache is empty", () => {
    const message = makeMessage();
    expect(flattenMessages(upsertInPages({ pages: [], pageParams: [] }, message))).toEqual([
      message,
    ]);
  });
});

const STATUSES: DeliveryStatus[] = ["sending", "sent", "delivered", "read", "failed"];
const RANK: Record<DeliveryStatus, number> = {
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: -1,
};

/**
 * Translation slots for the version matrix: none, or a version into the viewer's language (vi-VN)
 * or another one (en-US).
 */
const SLOTS = {
  none: null,
  v0: translation(0),
  v1: translation(1),
  v2: translation(2),
  other_v1: { ...translation(1), targetLanguage: "en-US" },
  other_v3: { ...translation(3), targetLanguage: "en-US" },
} satisfies Record<string, ContentTranslation | null>;
type Slot = keyof typeof SLOTS;
const SLOT_NAMES = Object.keys(SLOTS) as Slot[];

/** PLAN.md §13.2: an out-of-order event never lowers a tick, nor a translation in the same language. */
function keepsCurrentTranslation(current: Slot, incoming: Slot): boolean {
  const a = SLOTS[current];
  const b = SLOTS[incoming];
  return a !== null && b !== null && a.targetLanguage === b.targetLanguage && a.version > b.version;
}

describe("mergeMessage: delivery status (current × incoming)", () => {
  const rows = cartesian({ current: STATUSES, incoming: STATUSES });

  // A failure (local) or a recovery from it always wins; otherwise the furthest tick wins.
  function expected(current: DeliveryStatus, incoming: DeliveryStatus): DeliveryStatus {
    if (current === "failed" || incoming === "failed") return incoming;
    return RANK[current] > RANK[incoming] ? current : incoming;
  }

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    const current = makeMessage({ deliveryStatus: row.current });
    const merged = mergeMessage(current, { ...current, deliveryStatus: row.incoming });
    expect(merged.deliveryStatus).toBe(expected(row.current, row.incoming));
  });

  it("a stale optimistic copy never replaces the server's message", () => {
    const server = makeMessage({ clientId: "k1", deliveryStatus: "sent" });
    const optimistic = { ...server, id: "tmp_k1", deliveryStatus: "sending" as const };
    expect(mergeMessage(server, optimistic)).toBe(server);
  });
});

describe("translation merge (current × incoming), message list and conversation preview alike", () => {
  const rows = cartesian({ current: SLOT_NAMES, incoming: SLOT_NAMES });

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    const winner = keepsCurrentTranslation(row.current, row.incoming) ? row.current : row.incoming;
    const message = makeMessage({ translation: SLOTS[row.current] });
    const incoming = SLOTS[row.incoming];

    // Full message from a refetch or realtime echo.
    expect(mergeMessage(message, { ...message, translation: incoming }).translation).toEqual(
      SLOTS[winner],
    );
    if (incoming === null) return;

    // translation.updated for one message: the bubble and the conversation preview agree.
    const queryClient = new QueryClient();
    queryClient.setQueryData(chatKeys.messages(message.conversationId), data([message]));
    queryClient.setQueryData(chatKeys.conversations(), [
      makeConversation({ id: message.conversationId, lastMessage: message }),
    ]);
    setTranslation(queryClient, message.conversationId, message.id, incoming);
    const kept = keepsCurrentTranslation(row.current, row.incoming);
    const expectedTranslation = kept ? SLOTS[row.current] : incoming;
    const bubble = flattenMessages(
      queryClient.getQueryData<MessagesData>(chatKeys.messages(message.conversationId)),
    )[0];
    const preview = queryClient.getQueryData<Conversation[]>(chatKeys.conversations())?.[0];
    expect(bubble?.translation).toEqual(expectedTranslation);
    expect(preview?.lastMessage?.translation).toEqual(expectedTranslation);
    expect(bubble?.content).toEqual(message.content);
  });

  it("allows the failed → translating transition of a retry (same version)", () => {
    const message = makeMessage({
      translation: { ...translation(0), status: "failed", text: null },
    });
    const translating = applyTranslation(data([message]), message.id, {
      ...translation(0),
      status: "translating",
      text: null,
    });
    expect(flattenMessages(translating)[0]?.translation?.status).toBe("translating");
  });
});

describe("patch/remove", () => {
  it("patches by clientId and removes optimistic messages", () => {
    const optimistic = makeMessage({ id: "tmp_x", clientId: "x", deliveryStatus: "sending" });
    const patched = patchInPages(data([optimistic]), { id: "tmp_x", clientId: "x" }, (m) => ({
      ...m,
      deliveryStatus: "failed",
    }));
    expect(flattenMessages(patched)[0]?.deliveryStatus).toBe("failed");
    expect(flattenMessages(removeFromPages(patched, { id: "tmp_x", clientId: "x" }))).toEqual([]);
  });

  it("returns the same object when nothing matches", () => {
    const input = data([makeMessage()]);
    expect(patchInPages(input, { id: "nope", clientId: null }, (m) => m)).toBe(input);
  });
});

describe("conversation previews", () => {
  it("moves the conversation to the top and counts unread", () => {
    const first = makeConversation({ id: "c1", updatedAt: "2026-10-03T09:00:00.000Z" });
    const second = makeConversation({ id: "c2", updatedAt: "2026-10-03T09:30:00.000Z" });
    const message = makeMessage({ conversationId: "c1", senderId: "linh" });
    const result = withConversationPreview([second, first], message, { incrementUnread: true });
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result[0]?.unreadCount).toBe(1);
    expect(result[0]?.lastMessage).toEqual(message);
  });

  it("does not double count the same message and ignores older ones", () => {
    const message = makeMessage({ conversationId: "c1", senderId: "linh" });
    const once = withConversationPreview([makeConversation()], message, { incrementUnread: true });
    const twice = withConversationPreview(once, message, { incrementUnread: true });
    expect(twice[0]?.unreadCount).toBe(1);
    const older = makeMessage({ conversationId: "c1", createdAt: "2020-01-01T00:00:00.000Z" });
    expect(withConversationPreview(twice, older, { incrementUnread: true })).toBe(twice);
  });

  it("ignores unknown conversations and sets unread", () => {
    const list = [makeConversation()];
    expect(
      withConversationPreview(list, makeMessage({ conversationId: "zz" }), {
        incrementUnread: true,
      }),
    ).toBe(list);
    expect(withUnreadCount(list, "c1", 5)[0]?.unreadCount).toBe(5);
  });
});

describe("refetchIfLoading", () => {
  it("fetches again when an event arrives during the first load, and only then", async () => {
    const client = new QueryClient();
    let calls = 0;
    const releases: (() => void)[] = [];
    const observer = new QueryObserver(client, {
      queryKey: chatKeys.messages("c1"),
      queryFn: () => {
        calls += 1;
        return new Promise<MessagesData>((resolve) =>
          releases.push(() => resolve({ pages: [], pageParams: [] })),
        );
      },
    });
    const unsubscribe = observer.subscribe(() => undefined);
    expect(calls).toBe(1);

    // Two events during the first load: one extra fetch once it settles.
    refetchIfLoading(client, "c1");
    refetchIfLoading(client, "c1");
    expect(calls).toBe(1);
    releases.shift()?.();
    await vi.waitFor(() => expect(calls).toBe(2));

    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Nothing loading: events are applied to the cache directly, no fetch.
    refetchIfLoading(client, "c1");
    refetchIfLoading(client, "unknown");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(2);
    unsubscribe();
  });
});

describe("QueryClient wrappers", () => {
  function setup(lastMessage = makeMessage({ conversationId: "c1" })) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(chatKeys.messages("c1"), data([lastMessage]));
    queryClient.setQueryData(chatKeys.conversations(), [
      makeConversation({ id: "c1", lastMessage, updatedAt: lastMessage.createdAt }),
      makeConversation({ id: "c2", updatedAt: "2026-10-03T11:00:00.000Z" }),
    ]);
    const conversations = () =>
      queryClient.getQueryData<Conversation[]>(chatKeys.conversations()) ?? [];
    const messages = () =>
      flattenMessages(queryClient.getQueryData<MessagesData>(chatKeys.messages("c1")));
    return { queryClient, conversations, messages };
  }

  it.each([
    [true, 1],
    [false, 0],
  ])(
    "upsertMessage(incrementUnread=%s) adds %i unread and moves the chat up",
    (incrementUnread, unread) => {
      const { queryClient, conversations, messages } = setup();
      const incoming = makeMessage({
        conversationId: "c1",
        senderId: "linh",
        createdAt: "2026-10-03T12:00:00.000Z",
      });
      upsertMessage(queryClient, incoming, { incrementUnread });
      expect(messages().at(-1)?.id).toBe(incoming.id);
      expect(conversations()[0]).toMatchObject({ id: "c1", unreadCount: unread });
      expect(conversations()[0]?.lastMessage?.id).toBe(incoming.id);
    },
  );

  it("upsertMessage for a conversation missing from the list refetches the list", async () => {
    const { queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    upsertMessage(queryClient, makeMessage({ conversationId: "new" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatKeys.conversations() });
  });

  it("upsertMessage without a cached conversation still updates nothing it doesn't have", () => {
    const queryClient = new QueryClient();
    upsertMessage(queryClient, makeMessage({ conversationId: "c1" }));
    expect(queryClient.getQueryData(chatKeys.messages("c1"))).toBeUndefined();
    expect(queryClient.getQueryData(chatKeys.conversations())).toBeUndefined();
  });

  it("patchMessage patches the bubble and the preview when it is the last message", () => {
    const optimistic = makeMessage({
      id: "tmp_k1",
      clientId: "k1",
      conversationId: "c1",
      deliveryStatus: "sending",
    });
    const { queryClient, conversations, messages } = setup(optimistic);
    patchMessage(queryClient, "c1", { id: "tmp_k1", clientId: "k1" }, (m) => ({
      ...m,
      deliveryStatus: "failed",
    }));
    expect(messages()[0]?.deliveryStatus).toBe("failed");
    expect(conversations()[0]?.lastMessage?.deliveryStatus).toBe("failed");
    expect(conversations()[1]?.lastMessage).toBeNull();
  });

  it("removeMessage drops a discarded message from the bubbles", () => {
    const optimistic = makeMessage({ id: "tmp_k2", clientId: "k2", conversationId: "c1" });
    const { queryClient, messages } = setup(optimistic);
    removeMessage(queryClient, "c1", { id: "tmp_k2", clientId: "k2" });
    expect(messages()).toEqual([]);
  });

  it("setConversationUnread changes only that conversation", () => {
    const { queryClient, conversations } = setup();
    queryClient.setQueryData<Conversation[]>(chatKeys.conversations(), (list) =>
      list?.map((c) => ({ ...c, unreadCount: 4 })),
    );
    setConversationUnread(queryClient, "c1", 0);
    expect(conversations().map((c) => [c.id, c.unreadCount])).toEqual([
      ["c1", 0],
      ["c2", 4],
    ]);
  });
});

describe("compareMessages", () => {
  it("orders by creation time, then by id for equal times", () => {
    const at = "2026-10-03T10:00:00.000Z";
    const a = makeMessage({ id: "a", createdAt: at });
    const b = makeMessage({ id: "b", createdAt: at });
    const later = makeMessage({ id: "0", createdAt: "2026-10-03T10:00:01.000Z" });
    expect([later, b, a].sort(compareMessages).map((m) => m.id)).toEqual(["a", "b", "0"]);
    expect(compareMessages(a, { ...a })).toBe(0);
  });
});
