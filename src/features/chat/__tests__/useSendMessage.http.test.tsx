import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { useSendMessage } from "@/features/chat/hooks/useSendMessage";
import { flattenMessages, type MessagesData } from "@/features/chat/lib/messageCache";
import { chatKeys } from "@/features/chat/lib/queryKeys";
import { useComposerStore } from "@/features/chat/stores/composerStore";
import * as outbox from "@/services/outbox/store";
import { listPending, updatePending } from "@/services/outbox/store";
import { useSessionStore } from "@/stores/sessionStore";

/** Sending in the real build: the outbox keeps the message, the bubble shows it at once (PLANO_UX.md §3.1). */
const ME = "alice";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(profileKeys.me(), { id: ME, nativeLanguage: "pt-BR" });
  queryClient.setQueryData(chatKeys.messages("c1"), {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useSendMessage("c1"), { wrapper });
  const bubbles = () =>
    flattenMessages(queryClient.getQueryData<MessagesData>(chatKeys.messages("c1")));
  return { result, bubbles };
}

beforeEach(() => useSessionStore.setState({ status: "authenticated", userId: ME }));
afterEach(async () => {
  for (const entry of await listPending(ME)) await updatePending(entry.key, () => undefined);
  vi.restoreAllMocks();
});

describe("useSendMessage (http build)", () => {
  it("queues the send durably, shows it as sending and clears the composer", async () => {
    useComposerStore.getState().setDraft("c1", "Oi");
    const { result, bubbles } = setup();
    const queued = vi.fn();
    act(() => result.current.send("Oi", [], null, queued));

    await waitFor(async () => expect(await listPending(ME)).toHaveLength(1));
    expect(bubbles()).toMatchObject([
      { deliveryStatus: "sending", content: { body: { text: "Oi" } } },
    ]);
    expect(useComposerStore.getState().drafts["c1"]).toBe("");
    expect(queued).toHaveBeenCalledOnce();
  });

  it("if the device can't store it (quota), the text stays in the composer and nothing pretends to send", async () => {
    vi.spyOn(outbox, "persistSend").mockRejectedValue(
      new DOMException("full", "QuotaExceededError"),
    );
    const toastError = vi.spyOn(toast, "error");
    useComposerStore.getState().setDraft("c1", "Oi");
    const { result, bubbles } = setup();
    act(() => result.current.send("Oi", [], null));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(bubbles()).toEqual([]);
    expect(useComposerStore.getState().drafts["c1"]).toBe("Oi");
  });

  it("retrying a failed send shows it as sending again right away", async () => {
    const { result, bubbles } = setup();
    act(() => result.current.send("Oi", [], null));
    await waitFor(async () => expect(await listPending(ME)).toHaveLength(1));
    const [entry] = await listPending(ME);
    if (!entry) throw new Error("queued");
    // The worker refused it: failed, with Retry/Discard.
    await updatePending(entry.key, (e) =>
      e ? { ...e, blocked: true, message: { ...e.message, deliveryStatus: "failed" } } : e,
    );

    await act(async () => result.current.retry(entry.input.clientId));

    await waitFor(async () =>
      expect((await listPending(ME))[0]).toMatchObject({
        blocked: false,
        message: { deliveryStatus: "sending" },
      }),
    );
    expect(bubbles()[0]?.deliveryStatus).toBe("sending");
  });

  it("discarding removes the bubble and the queued send", async () => {
    const { result, bubbles } = setup();
    act(() => result.current.send("Oi", [], null));
    await waitFor(async () => expect(await listPending(ME)).toHaveLength(1));
    const clientId = bubbles()[0]?.clientId ?? "";

    act(() => result.current.discard(clientId));

    expect(bubbles()).toEqual([]);
    await waitFor(async () => expect(await listPending(ME)).toEqual([]));
  });
});
