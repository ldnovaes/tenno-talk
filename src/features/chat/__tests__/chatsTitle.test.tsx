import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { realtimeClient, type RealtimeStatus } from "@/services/realtime/realtimeClient";
import { renderWithProviders } from "@/test/utils";

import { ChatsTitle } from "../components/conversation-list/ChatsTitle";

describe("ChatsTitle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns into Connecting… while reconnecting and back when open", () => {
    let status: RealtimeStatus = "open";
    let notify: (next: RealtimeStatus) => void = () => undefined;
    vi.spyOn(realtimeClient, "getStatus").mockImplementation(() => status);
    vi.spyOn(realtimeClient, "onStatusChange").mockImplementation((handler) => {
      notify = handler;
      return () => undefined;
    });

    renderWithProviders(<ChatsTitle />);
    expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();

    act(() => {
      status = "reconnecting";
      notify(status);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Connecting…");

    act(() => {
      status = "open";
      notify(status);
    });
    expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();
  });

  it("does not flash while connecting for the first time", () => {
    vi.spyOn(realtimeClient, "getStatus").mockReturnValue("connecting");
    renderWithProviders(<ChatsTitle />);
    expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();
  });
});
