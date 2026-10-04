import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  applyReceipt,
  applyTranslation,
  flattenMessages,
  mergeMessage,
  patchInPages,
  refetchIfLoading,
  removeFromPages,
  upsertInPages,
  withConversationPreview,
  withUnreadCount,
  type MessagesData,
} from "@/features/chat/lib/messageCache";
import { chatKeys } from "@/features/chat/lib/queryKeys";
import type { ContentTranslation } from "@/types/message";

import { makeConversation, makeMessage } from "./fixtures";

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

describe("mergeMessage", () => {
  it("lets a failure override the status", () => {
    const current = makeMessage({ deliveryStatus: "sending" });
    expect(mergeMessage(current, { ...current, deliveryStatus: "failed" }).deliveryStatus).toBe(
      "failed",
    );
  });

  it("keeps the newer translation version", () => {
    const current = makeMessage({ translation: translation(2) });
    expect(
      mergeMessage(current, { ...current, translation: translation(1) }).translation?.version,
    ).toBe(2);
  });

  it("accepts a translation into another language", () => {
    const current = makeMessage({ translation: translation(2) });
    const other = { ...translation(1), targetLanguage: "en-US" };
    expect(mergeMessage(current, { ...current, translation: other }).translation).toEqual(other);
  });
});

describe("applyTranslation", () => {
  it("never touches the original and ignores stale versions", () => {
    const message = makeMessage({ translation: translation(1) });
    const updated = applyTranslation(data([message]), message.id, translation(2, "better"));
    const result = flattenMessages(updated)[0];
    expect(result?.translation?.text).toBe("better");
    expect(result?.content).toEqual(message.content);
    const stale = applyTranslation(updated, message.id, translation(1, "old"));
    expect(flattenMessages(stale)[0]?.translation?.text).toBe("better");
  });

  it("allows the translating → translated transition of a retry", () => {
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

describe("applyReceipt", () => {
  it("upgrades own messages up to the cursor only", () => {
    const a = makeMessage({ deliveryStatus: "sent" });
    const b = makeMessage({ deliveryStatus: "sent" });
    const theirs = makeMessage({ senderId: "linh", deliveryStatus: "read" });
    const c = makeMessage({ deliveryStatus: "sent" });
    const result = flattenMessages(applyReceipt(data([a, b, theirs, c]), "me", b.id, "read"));
    expect(result.map((m) => m.deliveryStatus)).toEqual(["read", "read", "read", "sent"]);
  });

  it("does not touch sending or failed messages and never downgrades", () => {
    const sending = makeMessage({ deliveryStatus: "sending" });
    const read = makeMessage({ deliveryStatus: "read" });
    const input = data([read, sending]);
    const result = applyReceipt(input, "me", sending.id, "delivered");
    expect(result).toBe(input);
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
