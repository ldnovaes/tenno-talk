import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { controllableIntersection } from "@/test/intersection";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/** Conversation flows with no test before (PLAN.md §9.3–9.4). */
beforeEach(() => {
  setViewportWidth(1280);
  signInAs("usr_rafael");
});
afterEach(() => vi.unstubAllGlobals());

describe("muting a conversation", () => {
  it("shows it as muted in the list and unmutes (the badge rule is in totalUnread)", async () => {
    const user = userEvent.setup();
    mockDb.update((db) => {
      const conversation = db.conversations["conv_rafael_linh"];
      if (conversation) conversation.lastReadMessageId["usr_rafael"] = null;
    });
    renderApp("/chats/conv_rafael_linh");
    await screen.findByRole("log", { name: "Messages" });

    await user.click(screen.getByRole("button", { name: "Conversation menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Mute notifications" }));

    const list = screen.getByRole("list", { name: "Chats" });
    const row = await within(list).findByRole("link", { name: /Linh Pham/ });
    await waitFor(() => expect(within(row).getByLabelText("Muted")).toBeInTheDocument());
    expect(
      mockDb.read().conversations["conv_rafael_linh"]?.mutedUntil["usr_rafael"],
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Conversation menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Unmute notifications" }));
    await waitFor(() => expect(within(row).queryByLabelText("Muted")).not.toBeInTheDocument());
  });
});

describe("older messages", () => {
  it("load when the top of the conversation scrolls into view, in order and without repeats", async () => {
    const intersection = controllableIntersection();
    mockDb.update((db) => {
      const start = Date.parse("2026-01-01T00:00:00.000Z");
      for (let n = 0; n < 45; n++) {
        const id = `msg_old_${String(n).padStart(2, "0")}`;
        db.messages[id] = {
          id,
          clientId: null,
          conversationId: "conv_rafael_emma",
          senderId: n % 2 ? "usr_rafael" : "usr_emma",
          content: {
            type: "text",
            body: { text: `Old ${n}`, language: n % 2 ? "pt-BR" : "en-US" },
          },
          translations: {},
          literals: {},
          replyToId: null,
          reactions: [],
          statusOverride: null,
          createdAt: new Date(start + n * 60_000).toISOString(),
        };
      }
    });
    renderApp("/chats/conv_rafael_emma");
    const log = await screen.findByRole("log", { name: "Messages" });
    await within(log).findByText("Old 44");
    expect(within(log).queryByText("Old 0")).not.toBeInTheDocument();

    for (let page = 0; page < 3 && !within(log).queryByText("Old 0"); page++) {
      act(() => intersection.showAll());
      await waitFor(() =>
        expect(screen.queryByText("Loading older messages…")).not.toBeInTheDocument(),
      );
    }
    expect(await within(log).findByText("Old 0")).toBeInTheDocument();
    const texts = within(log)
      .getAllByText(/^Old \d+$/)
      .map((node) => Number(node.textContent?.slice(4)));
    expect(texts).toEqual([...texts].sort((a, b) => a - b));
    expect(new Set(texts).size).toBe(texts.length);
  });
});
