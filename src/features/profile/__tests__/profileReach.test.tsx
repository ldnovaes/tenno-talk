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

  // Production, 2026-10-04: a forgotten block made every profile of the other account "not found".
  it("shows not found for a chat partner after a block", async () => {
    const user = userEvent.setup();
    mockDb.update((db) => {
      db.users["usr_rafael"]?.blockedUserIds.push("usr_linh");
    });
    renderApp("/chats/conv_rafael_linh");
    await user.click(await screen.findByRole("button", { name: "Open Linh Pham's profile" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });
});
