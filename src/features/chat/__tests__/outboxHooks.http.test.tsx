import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { useOutbox } from "@/features/chat/hooks/useOutbox";
import { usePendingSends } from "@/features/chat/hooks/usePendingSends";
import { useReleaseLiftedSends } from "@/features/chat/hooks/useReleaseLiftedSends";
import { chatKeys } from "@/features/chat/lib/queryKeys";
import { listPending, persistSend, updatePending } from "@/services/outbox/store";
import { useSessionStore } from "@/stores/sessionStore";
import type { Conversation } from "@/types/conversation";
import { fakeServer } from "@/test/fakeServer";
import { makeConversation, makeMessage } from "@/test/factories";

/** The HTTP-only hooks around the outbox (PLANO_UX.md §3.1, PLAN.md §31.1). */
const ME = "alice";

function client() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(profileKeys.me(), { id: ME, nativeLanguage: "pt-BR" });
  return queryClient;
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

async function queue(
  clientId: string,
  conversationId = "c1",
  state: { blocked?: boolean; failureCode?: string } = {},
) {
  const input = { clientId, conversationId, text: clientId, media: [], replyToId: null };
  await persistSend(
    ME,
    input,
    makeMessage({
      id: `tmp_${clientId}`,
      clientId,
      conversationId,
      senderId: ME,
      deliveryStatus: "sending",
    }),
  );
  await updatePending(`${ME}:${clientId}`, (e) => (e ? { ...e, ...state } : e));
}

const pending = async () =>
  (await listPending(ME)).map((e) => [e.input.clientId, e.blocked, e.failureCode ?? null]);
const posted = () =>
  fakeServer.requests
    .filter((r) => r.method === "POST" && r.url.endsWith("/messages"))
    .map((r) => (r.body as { clientId: string }).clientId);

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  useSessionStore.setState({ status: "authenticated", userId: ME });
  fakeServer.on("GET", "/api/me", { body: { id: ME } });
});

afterEach(async () => {
  for (const entry of await listPending(ME)) await updatePending(entry.key, () => undefined);
});

describe("useOutbox", () => {
  it("on start, retries sends held for the session, never the refused ones", async () => {
    await queue("held", "c1", { blocked: true, failureCode: "unauthenticated" });
    await queue("refused", "c2", { blocked: true, failureCode: "forbidden" });
    fakeServer.on("POST", "/api/conversations/c1/messages", {
      body: makeMessage({ id: "m1", clientId: "held", conversationId: "c1" }),
    });

    const queryClient = client();
    const { unmount } = renderHook(() => useOutbox(ME), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(posted()).toEqual(["held"]));
    await waitFor(async () => expect(await pending()).toEqual([["refused", true, "forbidden"]]));
    unmount();
  });

  it("keeps each conversation in order: a send that fails holds the ones after it", async () => {
    await queue("first", "c1");
    await queue("second", "c1");
    await queue("other", "c2");
    fakeServer.on("POST", "/api/conversations/c1/messages", { status: 503 });
    fakeServer.on("POST", "/api/conversations/c2/messages", {
      body: makeMessage({ id: "m2", clientId: "other", conversationId: "c2" }),
    });

    const { unmount } = renderHook(() => useOutbox(ME), { wrapper: wrapper(client()) });

    await waitFor(() => expect(posted()).toContain("other"));
    expect(posted().filter((id) => id === "second")).toHaveLength(0);
    unmount();
  });

  it("shows queued sends in the conversation right away, and the sent message afterwards", async () => {
    await queue("k1", "c1");
    fakeServer.on("POST", "/api/conversations/c1/messages", {
      body: makeMessage({ id: "m1", clientId: "k1", conversationId: "c1", deliveryStatus: "sent" }),
    });
    const queryClient = client();
    queryClient.setQueryData(chatKeys.messages("c1"), {
      pages: [{ items: [], nextCursor: null }],
      pageParams: [null],
    });
    const { unmount } = renderHook(() => useOutbox(ME), { wrapper: wrapper(queryClient) });

    await waitFor(() => {
      const items = queryClient.getQueryData<{ pages: { items: { id: string }[] }[] }>(
        chatKeys.messages("c1"),
      )?.pages[0]?.items;
      expect(items?.map((item) => item.id)).toEqual(["m1"]);
    });
    unmount();
  });

  it("a refused send refreshes the conversation so it can say why", async () => {
    await queue("k1", "c1");
    fakeServer.on("POST", "/api/conversations/c1/messages", {
      status: 403,
      body: { code: "forbidden" },
    });
    const queryClient = client();
    queryClient.setQueryData(chatKeys.conversations(), [makeConversation({ id: "c1" })]);
    const { unmount } = renderHook(() => useOutbox(ME), { wrapper: wrapper(queryClient) });
    await waitFor(() =>
      expect(queryClient.getQueryState(chatKeys.conversations())?.isInvalidated).toBe(true),
    );
    unmount();
  });
});

describe("usePendingSends", () => {
  it("retries and discards only this account's sends", async () => {
    await queue("k1", "c1", { blocked: true, failureCode: "forbidden" });
    await queue("k2", "c1", { blocked: true, failureCode: "forbidden" });
    const { result } = renderHook(() => usePendingSends(), { wrapper: wrapper(client()) });

    await act(() => result.current.action.mutateAsync({ id: `${ME}:k1`, discard: false }));
    await act(() => result.current.action.mutateAsync({ id: `${ME}:k2`, discard: true }));
    await act(() => result.current.action.mutateAsync({ id: "bob:k3", discard: true }));

    expect(await pending()).toEqual([["k1", false, "forbidden"]]);
  });
});

describe("useReleaseLiftedSends", () => {
  function conversations(restriction: Conversation["sendRestriction"]) {
    fakeServer.reset();
    fakeServer.on("GET", "/api/conversations", {
      body: [makeConversation({ id: "c1", sendRestriction: restriction })],
    });
  }

  it("a send refused by a restriction goes out once the restriction is lifted", async () => {
    await queue("k1", "c1", { blocked: true, failureCode: "forbidden" });
    await queue("k2", "c2", { blocked: true, failureCode: "forbidden" });
    conversations("followers_only");
    const queryClient = client();
    renderHook(() => useReleaseLiftedSends(ME), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(queryClient.getQueryData(chatKeys.conversations())).toBeDefined());
    expect(await pending()).toEqual([
      ["k1", true, "forbidden"],
      ["k2", true, "forbidden"],
    ]);

    conversations(null);
    await act(() => queryClient.refetchQueries({ queryKey: chatKeys.conversations() }));

    await waitFor(async () =>
      expect(await pending()).toEqual([
        ["k1", false, "forbidden"],
        ["k2", true, "forbidden"],
      ]),
    );
  });
});
