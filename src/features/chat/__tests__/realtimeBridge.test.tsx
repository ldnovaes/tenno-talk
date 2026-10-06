import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeBridge } from "@/features/chat/hooks/useRealtimeBridge";
import { flattenMessages, type MessagesData } from "@/features/chat/lib/messageCache";
import { chatKeys } from "@/features/chat/lib/queryKeys";
import * as acks from "@/services/realtime/deliveryAcks";
import { usePresenceStore } from "@/stores/presenceStore";
import type { Conversation } from "@/types/conversation";
import type { RealtimeEvent } from "@/services/realtime/realtimeClient";
import { fakeRealtime } from "@/test/fakeRealtime";
import { makeConversation, makeMessage } from "@/test/factories";

/** Every realtime event and status into the cache and the presence store (PLAN.md §17, §13.3). */
const ME = "me";

let realtime: ReturnType<typeof fakeRealtime>;
let queryClient: QueryClient;

function mount() {
  queryClient = new QueryClient();
  queryClient.setQueryData(chatKeys.conversations(), [
    makeConversation({ id: "c1", unreadCount: 0, updatedAt: "2026-10-03T09:00:00.000Z" }),
  ]);
  queryClient.setQueryData(chatKeys.messages("c1"), {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRealtimeBridge(ME), { wrapper });
}

const bubbles = () =>
  flattenMessages(queryClient.getQueryData<MessagesData>(chatKeys.messages("c1")));
const conversation = () => queryClient.getQueryData<Conversation[]>(chatKeys.conversations())?.[0];
const invalidated = (key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated === true;

beforeEach(() => {
  realtime = fakeRealtime();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useRealtimeBridge", () => {
  it("connects as the viewer and, when unmounted, disconnects and forgets live presence", () => {
    const { unmount } = mount();
    expect(realtime.connect).toHaveBeenCalledWith({ userId: ME });
    act(() => usePresenceStore.getState().setOnline("linh", true));
    unmount();
    expect(realtime.disconnect).toHaveBeenCalled();
    expect(usePresenceStore.getState().online).toEqual({});
    const events: RealtimeEvent[] = ["message.created", "typing.started", "user.online"];
    expect(events.map((event) => realtime.subscribers(event))).toEqual([0, 0, 0]);
  });

  it.each([
    ["from someone else", "linh", true, 1],
    ["my own (another tab)", ME, false, 0],
  ])("message.created %s", (_name, senderId, acked, unread) => {
    const ack = vi.spyOn(acks, "acknowledgeReceived").mockImplementation(() => {});
    mount();
    const message = makeMessage({
      id: "m1",
      conversationId: "c1",
      senderId,
      createdAt: "2026-10-03T12:00:00.000Z",
    });
    act(() => realtime.emit("message.created", { message }));
    expect(bubbles().map((m) => m.id)).toEqual(["m1"]);
    expect(conversation()).toMatchObject({ unreadCount: unread, lastMessage: { id: "m1" } });
    expect(ack).toHaveBeenCalledTimes(acked ? 1 : 0);
    if (acked) expect(ack).toHaveBeenCalledWith("c1", ["m1"]);
  });

  it("message.updated merges into the bubble without lowering its ticks", () => {
    mount();
    const read = makeMessage({
      id: "m1",
      conversationId: "c1",
      senderId: ME,
      deliveryStatus: "read",
    });
    act(() => realtime.emit("message.updated", { message: read }));
    act(() =>
      realtime.emit("message.updated", {
        message: {
          ...read,
          deliveryStatus: "delivered",
          reactions: [{ emoji: "❤️", count: 1, reactedByMe: false }],
        },
      }),
    );
    expect(bubbles()[0]).toMatchObject({ deliveryStatus: "read", reactions: [{ emoji: "❤️" }] });
  });

  it("translation.updated replaces the translation of that message only", () => {
    mount();
    act(() =>
      realtime.emit("message.created", {
        message: makeMessage({ id: "m1", conversationId: "c1", senderId: "linh" }),
      }),
    );
    const translation = {
      targetLanguage: "pt-BR",
      text: "Oi",
      status: "translated" as const,
      version: 1,
      updatedAt: "",
    };
    act(() =>
      realtime.emit("translation.updated", { conversationId: "c1", messageId: "m1", translation }),
    );
    expect(bubbles()[0]?.translation).toEqual(translation);
  });

  it.each(["message.delivered", "message.read"] as const)(
    "%s refetches that conversation's messages",
    (event) => {
      mount();
      act(() =>
        realtime.emit(event, {
          conversationId: "c1",
          readerId: "linh",
          recipientId: "linh",
          upToMessageId: "m1",
        }),
      );
      expect(invalidated(chatKeys.messages("c1"))).toBe(true);
    },
  );

  it("typing shows, renews, and disappears after 6 s without renewal", () => {
    vi.useFakeTimers();
    mount();
    const typing = () => usePresenceStore.getState().typing["c1"] ?? [];
    act(() => realtime.emit("typing.started", { conversationId: "c1", userId: "linh" }));
    expect(typing()).toEqual(["linh"]);
    act(() => vi.advanceTimersByTime(5000));
    act(() => realtime.emit("typing.started", { conversationId: "c1", userId: "linh" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(typing()).toEqual(["linh"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(typing()).toEqual([]);
  });

  it("typing.stopped hides it at once, for that person only", () => {
    mount();
    act(() => realtime.emit("typing.started", { conversationId: "c1", userId: "linh" }));
    act(() => realtime.emit("typing.started", { conversationId: "c1", userId: "ana" }));
    act(() => realtime.emit("typing.stopped", { conversationId: "c1", userId: "linh" }));
    expect(usePresenceStore.getState().typing["c1"]).toEqual(["ana"]);
  });

  it("presence events update who is online and when they were last seen", () => {
    mount();
    act(() => realtime.emit("user.online", { userId: "linh" }));
    expect(usePresenceStore.getState().online["linh"]).toBe(true);
    act(() =>
      realtime.emit("user.offline", { userId: "linh", lastSeenAt: "2026-10-05T10:00:00.000Z" }),
    );
    expect(usePresenceStore.getState()).toMatchObject({
      online: { linh: false },
      lastSeen: { linh: "2026-10-05T10:00:00.000Z" },
    });
  });

  it("losing the connection forgets live presence; getting it back refetches the chat", () => {
    mount();
    act(() => realtime.emit("user.online", { userId: "linh" }));
    act(() => realtime.status("reconnecting"));
    expect(usePresenceStore.getState().online).toEqual({});
    expect(invalidated(chatKeys.conversations())).toBe(false);
    act(() => realtime.status("open"));
    expect(invalidated(chatKeys.conversations())).toBe(true);
    expect(invalidated(chatKeys.messages("c1"))).toBe(true);
  });
});
