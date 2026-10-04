import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

describe("stories", () => {
  beforeEach(() => {
    signInAs("usr_lucas");
    setViewportWidth(1280);
  });

  it("shows the tray in chats with the viewer first", async () => {
    renderApp("/chats");
    const tray = await screen.findByRole("region", { name: "Stories" });
    const links = await within(tray).findAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Open your stories");
    expect(
      within(tray).getByRole("link", { name: "Open Cam Nguyen's stories" }),
    ).toBeInTheDocument();
  });

  it("opens the viewer, translates the text and navigates", async () => {
    const user = userEvent.setup();
    renderApp("/chats");
    await user.click(await screen.findByRole("link", { name: "Open Cam Nguyen's stories" }));
    const viewer = await screen.findByRole("dialog", { name: "Stories of Cam Nguyen" });
    expect(within(viewer).getByText("Café com ovo de manhã ☕")).toHaveAttribute("lang", "pt-BR");
    await user.click(within(viewer).getByRole("button", { name: "See original" }));
    expect(within(viewer).getByText("Cà phê trứng buổi sáng ☕")).toHaveAttribute("lang", "vi-VN");
    expect(within(viewer).getByRole("progressbar", { name: "Story 1 of 2" })).toBeInTheDocument();
    await user.click(within(viewer).getByRole("button", { name: "Next story" }));
    expect(within(viewer).getByRole("progressbar", { name: "Story 2 of 2" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(within(viewer).getByRole("progressbar", { name: "Story 1 of 2" })).toBeInTheDocument();
    await waitFor(() =>
      expect(mockDb.read().stories["story_cam_1"]?.viewedBy).toContain("usr_lucas"),
    );
  });

  it("replies by direct message and closes with Escape", async () => {
    const user = userEvent.setup();
    renderApp("/stories/usr_cam");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Cam Nguyen" });
    await user.type(
      within(viewer).getByRole("textbox", { name: "Reply to Cam Nguyen…" }),
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
        screen.queryByRole("dialog", { name: "Stories of Cam Nguyen" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("reacts to a story", async () => {
    const user = userEvent.setup();
    renderApp("/stories/usr_sofia");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Sofía Martínez" });
    await user.click(within(viewer).getByRole("button", { name: "React 😂" }));
    expect(await screen.findByText("Reaction sent")).toBeInTheDocument();
  });

  it("does not offer replies on your own story", async () => {
    renderApp("/stories/usr_lucas");
    const viewer = await screen.findByRole("dialog", { name: "Stories of Lucas Almeida" });
    expect(within(viewer).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an unavailable state for unknown stories", async () => {
    renderApp("/stories/usr_nobody");
    expect(await screen.findByText("This story is no longer available.")).toBeInTheDocument();
  });

  it("shows story replies in the chat", async () => {
    mockDb.update((db) => {
      const message = db.messages["msg_lucas_cam_041"];
      if (message && message.content.type === "text") {
        message.content = {
          type: "story_reply",
          storyId: "story_lucas_1",
          body: message.content.body,
        };
      }
    });
    renderApp("/chats/conv_lucas_cam");
    expect(await screen.findByText("Replied to a story")).toBeInTheDocument();
  });
});
