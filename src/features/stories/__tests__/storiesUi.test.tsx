import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

describe("stories", () => {
  beforeEach(() => {
    signInAs("usr_rafael");
    setViewportWidth(1280);
  });

  it("shows the tray in chats with the viewer first", async () => {
    renderApp("/chats");
    const tray = await screen.findByRole("region", { name: "Stories" });
    const links = await within(tray).findAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Open your stories");
    expect(
      within(tray).getByRole("link", { name: "Open Linh Pham's stories" }),
    ).toBeInTheDocument();
  });

  it("opens the viewer, translates the text and navigates", async () => {
    const user = userEvent.setup();
    renderApp("/chats");
    await user.click(await screen.findByRole("link", { name: "Open Linh Pham's stories" }));
    const viewer = await screen.findByRole("dialog", { name: "Stories of Linh Pham" });
    expect(within(viewer).getByText("Café com ovo de manhã ☕")).toHaveAttribute("lang", "pt-BR");
    await user.click(within(viewer).getByRole("button", { name: "See original" }));
    expect(within(viewer).getByText("Cà phê trứng buổi sáng ☕")).toHaveAttribute("lang", "vi-VN");
    expect(within(viewer).getByRole("progressbar", { name: "Story 1 of 2" })).toBeInTheDocument();
    await user.click(within(viewer).getByRole("button", { name: "Next story" }));
    expect(within(viewer).getByRole("progressbar", { name: "Story 2 of 2" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(within(viewer).getByRole("progressbar", { name: "Story 1 of 2" })).toBeInTheDocument();
    await waitFor(() =>
      expect(mockDb.read().stories["story_linh_1"]?.viewedBy).toContain("usr_rafael"),
    );
  });

  it("replies by direct message and closes with Escape", async () => {
    const user = userEvent.setup();
    renderApp("/stories/usr_linh");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Linh Pham" });
    await user.type(
      within(viewer).getByRole("textbox", { name: "Reply to Linh Pham…" }),
      "Que delícia!",
    );
    await user.click(within(viewer).getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Reply sent")).toBeInTheDocument();
    expect(
      Object.values(mockDb.read().messages).some(
        (m) => m.content.type === "story_reply" && m.content.body.text === "Que delícia!",
      ),
    ).toBe(true);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Stories of Linh Pham" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("a reaction is confirmed inside the viewer, never over its header (PLAN.md §9.9)", async () => {
    const user = userEvent.setup();
    renderApp("/stories/usr_sofia");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Sofía Martínez" });
    await user.click(within(viewer).getByRole("button", { name: "React 😂" }));
    await waitFor(() =>
      expect(within(viewer).getByRole("status")).toHaveTextContent("Reaction sent"),
    );
    expect(screen.getAllByText("Reaction sent")).toHaveLength(1);
    expect(within(viewer).getByRole("button", { name: "Close stories" })).toBeVisible();
  });

  it("the author finds the reaction in the conversation, like Instagram", async () => {
    const user = userEvent.setup();
    const first = renderApp("/stories/usr_sofia");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Sofía Martínez" });
    await user.click(within(viewer).getByRole("button", { name: "React 😂" }));
    await waitFor(() =>
      expect(within(viewer).getByRole("status")).toHaveTextContent("Reaction sent"),
    );
    first.unmount();

    signInAs("usr_sofia");
    setViewportWidth(1280);
    renderApp("/chats/conv_rafael_sofia");
    expect(await screen.findAllByText("Reacted 😂 to your story")).not.toHaveLength(0);
    const log = await screen.findByRole("log", { name: "Messages" });
    expect(within(log).getByText("Reacted to your story")).toBeInTheDocument();
    expect(within(log).getByText("😂")).toBeInTheDocument();
  });

  it("does not offer replies on your own story", async () => {
    renderApp("/stories/usr_rafael");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Rafael Souza" });
    expect(within(viewer).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an unavailable state for unknown stories", async () => {
    renderApp("/stories/usr_nobody");
    expect(await screen.findByText("This story is no longer available.")).toBeInTheDocument();
  });

  it("shows story replies in the chat", async () => {
    mockDb.update((db) => {
      const message = db.messages["msg_rafael_linh_041"];
      if (message && message.content.type === "text") {
        message.content = {
          type: "story_reply",
          storyId: "story_rafael_1",
          body: message.content.body,
        };
      }
    });
    renderApp("/chats/conv_rafael_linh");
    expect(await screen.findByText("Replied to a story")).toBeInTheDocument();
  });
});
