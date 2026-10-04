import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { realtimeClient } from "@/services/realtime/realtimeClient";
import { useTypingEmitter } from "./useTypingEmitter";
import type { RealtimeStatus } from "@/services/realtime/realtimeClient";
vi.mock("@/services/realtime/realtimeClient", () => ({
  realtimeClient: { emitTyping: vi.fn(), onStatusChange: vi.fn() },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
it("retries unsent typing on reconnect and stops after idle", () => {
  vi.useFakeTimers();
  let status: (status: RealtimeStatus) => void = () => undefined;
  vi.mocked(realtimeClient.onStatusChange).mockImplementation((listener) => {
    status = listener;
    return () => undefined;
  });
  vi.mocked(realtimeClient.emitTyping).mockReturnValue(false);
  const { result } = renderHook(() => useTypingEmitter("conversation"));
  act(() => result.current.onInput());
  expect(realtimeClient.emitTyping).toHaveBeenCalledWith("conversation", true);
  vi.mocked(realtimeClient.emitTyping).mockReturnValue(true);
  act(() => status("open"));
  expect(realtimeClient.emitTyping).toHaveBeenCalledTimes(2);
  act(() => vi.advanceTimersByTime(5000));
  expect(realtimeClient.emitTyping).toHaveBeenLastCalledWith("conversation", false);
  act(() => status("open"));
  expect(realtimeClient.emitTyping).toHaveBeenCalledTimes(3);
});
