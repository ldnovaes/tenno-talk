import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppErrorCode } from "@/lib/errors";

/** The module keeps its queue in memory: a fresh copy per test. */
async function load() {
  vi.resetModules();
  const { chatService: service } = await import("@/services/chatService");
  const { useSessionStore: store } = await import("@/stores/sessionStore");
  const { acknowledgeReceived } = await import("@/services/realtime/deliveryAcks");
  // Errors must come from the same (fresh) module, or `instanceof AppError` fails.
  const { AppError } = await import("@/lib/errors");
  store.setState({ status: "authenticated", userId: "me" });
  const acknowledge = vi.spyOn(service, "acknowledge");
  return { acknowledgeReceived, acknowledge, store, AppError };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("acknowledgeReceived", () => {
  it("sends received ids, never optimistic ones", async () => {
    const { acknowledgeReceived, acknowledge } = await load();
    acknowledge.mockResolvedValue(undefined);
    acknowledgeReceived("c1", ["m1", "tmp_x", "m2"]);
    await flush();
    expect(acknowledge).toHaveBeenCalledWith("c1", ["m1", "m2"]);
  });

  it("sends nothing without a session or without real ids", async () => {
    const { acknowledgeReceived, acknowledge, store } = await load();
    acknowledgeReceived("c1", ["tmp_a"]);
    store.setState({ status: "anonymous", userId: null });
    acknowledgeReceived("c2", ["m1"]);
    await flush();
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("batches at most 100 ids per request and sends the rest later", async () => {
    const { acknowledgeReceived, acknowledge } = await load();
    acknowledge.mockResolvedValue(undefined);
    const ids = Array.from({ length: 150 }, (_, n) => `m${n}`);
    acknowledgeReceived("c1", ids);
    await flush();
    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(acknowledge.mock.calls[0]?.[1]).toHaveLength(100);
    await vi.advanceTimersByTimeAsync(5000);
    expect(acknowledge).toHaveBeenCalledTimes(2);
    expect(acknowledge.mock.calls[1]?.[1]).toEqual(ids.slice(100));
  });

  it.each(["network", "rate_limited", "unknown"] as AppErrorCode[])(
    "retries every pending ack after a %s error",
    async (code) => {
      const { acknowledgeReceived, acknowledge, AppError } = await load();
      acknowledge.mockRejectedValueOnce(new AppError(code, "x")).mockResolvedValue(undefined);
      acknowledgeReceived("c1", ["m1"]);
      await flush();
      await vi.advanceTimersByTimeAsync(5000);
      expect(acknowledge).toHaveBeenLastCalledWith("c1", ["m1"]);
    },
  );

  it.each(["forbidden", "not_found", "validation"] as AppErrorCode[])(
    "a %s error drops only that conversation's acks, not the others'",
    async (code) => {
      const { acknowledgeReceived, acknowledge, AppError } = await load();
      acknowledge.mockImplementation((conversation) =>
        conversation === "left_group"
          ? Promise.reject(new AppError(code, "x"))
          : Promise.resolve(undefined),
      );
      acknowledgeReceived("left_group", ["g1"]);
      acknowledgeReceived("c2", ["m2"]);
      await flush();
      await vi.advanceTimersByTimeAsync(5000);
      expect(acknowledge).toHaveBeenCalledWith("c2", ["m2"]);
      expect(acknowledge.mock.calls.filter(([c]) => c === "left_group")).toHaveLength(1);
    },
  );

  it("never sends one account's acks as another account", async () => {
    const { acknowledgeReceived, acknowledge, store, AppError } = await load();
    acknowledge.mockRejectedValueOnce(new AppError("network", "x")).mockResolvedValue(undefined);
    acknowledgeReceived("c1", ["m1"]);
    await flush();
    store.setState({ status: "authenticated", userId: "other" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });
});
