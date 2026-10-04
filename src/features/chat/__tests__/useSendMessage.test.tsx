import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { profileService } from "@/services/profileService";
import { createTestQueryClient, signInAs } from "@/test/utils";

import { useSendMessage } from "../hooks/useSendMessage";

describe("useSendMessage", () => {
  it("keeps its callbacks stable while a send goes through (bubbles must not all re-render)", async () => {
    signInAs("usr_rafael");
    const client = createTestQueryClient();
    client.setQueryData(profileKeys.me(), await profileService.getMe());
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSendMessage("conv_rafael_linh"), { wrapper });
    const first = result.current;
    act(() => first.send("Oi", [], null));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(result.current.send).toBe(first.send);
    expect(result.current.retry).toBe(first.retry);
    expect(result.current.discard).toBe(first.discard);
  });
});
