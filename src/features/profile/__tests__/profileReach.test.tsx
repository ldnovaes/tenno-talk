import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/** Opening someone's profile from the places people actually start: Discover and a chat. */
describe.each([
  ["desktop", 1280],
  ["mobile", 390],
])("reaching a profile on %s", (_, width) => {
  beforeEach(() => {
    signInAs("usr_rafael");
    setViewportWidth(width);
  });

  it("opens a person's profile from their Discover card", async () => {
    const user = userEvent.setup();
    renderApp("/discover");
    const card = (await screen.findByText("Sofía Martínez")).closest("article");
    if (!(card instanceof HTMLElement)) throw new Error("card not found");
    await user.click(within(card).getByRole("link", { name: /Sofía Martínez/ }));
    expect(await screen.findByRole("heading", { name: "@sofia" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sofía Martínez" })).toBeInTheDocument();
    expect(screen.queryByText("User not found")).not.toBeInTheDocument();
  });

  it("opens the other person's profile from the conversation header", async () => {
    const user = userEvent.setup();
    renderApp("/chats/conv_rafael_linh");
    await user.click(await screen.findByRole("button", { name: "Open Linh Pham's profile" }));
    expect(await screen.findByRole("heading", { name: "@linh" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Linh Pham" })).toBeInTheDocument();
    expect(screen.queryByText("User not found")).not.toBeInTheDocument();
  });

  // Production, 2026-10-05: the profile of someone I blocked said "not found" (PLAN.md §31.1).
  it("says who I blocked, in the chat and on the profile, and unblocks from there", async () => {
    const user = userEvent.setup();
    mockDb.update((db) => {
      db.users["usr_rafael"]?.blockedUserIds.push("usr_linh");
    });
    renderApp("/chats/conv_rafael_linh");
    expect(await screen.findByText("You blocked Linh Pham.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /message/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Open Linh Pham's profile" }));
    expect(await screen.findByText("You blocked Linh Pham")).toBeInTheDocument();
    expect(screen.queryByText("User not found")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unblock" }));
    expect(await screen.findByRole("button", { name: "Message" })).toBeInTheDocument();
    expect(mockDb.read().users["usr_rafael"]?.blockedUserIds).not.toContain("usr_linh");
  });

  it("shows only who someone is when they blocked me", async () => {
    mockDb.update((db) => {
      db.users["usr_linh"]?.blockedUserIds.push("usr_rafael");
    });
    renderApp("/u/linh");
    expect(await screen.findByText("This profile isn't available")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Linh Pham" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Profile menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    expect(screen.queryByText("Followers")).not.toBeInTheDocument();
  });
});
