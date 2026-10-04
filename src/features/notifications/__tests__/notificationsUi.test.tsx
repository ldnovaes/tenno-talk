import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { publish } from "@/services/mock/events";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

describe("notifications", () => {
  beforeEach(() => {
    signInAs("usr_rafael");
    setViewportWidth(1280);
  });

  it("shows the unread badge on the rail", async () => {
    renderApp("/chats");
    const link = await screen.findByRole("link", { name: "Notifications" });
    await waitFor(() => expect(within(link).getByText("5")).toBeInTheDocument());
  });

  it("groups notifications and reads the observed list explicitly", async () => {
    renderApp("/notifications");
    expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This week" })).toBeInTheDocument();
    expect(screen.getByText(/reacted 😍 to your story/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Notifications" });
    expect(within(link).getByText("5")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(within(link).queryByText("5")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        Object.values(mockDb.read().notifications).every(
          (n) => n.recipientId !== "usr_rafael" || n.readAt,
        ),
      ).toBe(true),
    );
  });

  it("follows back from a follow notification", async () => {
    const user = userEvent.setup();
    mockDb.update((db) => {
      db.follows = db.follows.filter(
        (f) => !(f.followerId === "usr_rafael" && f.followeeId === "usr_sofia"),
      );
    });
    renderApp("/notifications");
    await user.click(await screen.findByRole("button", { name: "Follow back" }));
    await waitFor(() =>
      expect(
        mockDb
          .read()
          .follows.some((f) => f.followerId === "usr_rafael" && f.followeeId === "usr_sofia"),
      ).toBe(true),
    );
  });

  it("opens the conversation from a new message notification", async () => {
    const user = userEvent.setup();
    renderApp("/notifications");
    const item = (await screen.findByText(/sent you a message/)).closest("li");
    if (!(item instanceof HTMLElement)) throw new Error("item not found");
    await user.click(within(item).getByRole("button", { name: "View" }));
    expect(await screen.findByRole("log", { name: "Messages" })).toBeInTheDocument();
  });

  it("updates the badge in realtime", async () => {
    renderApp("/chats");
    const link = await screen.findByRole("link", { name: "Notifications" });
    await waitFor(() => expect(within(link).getByText("5")).toBeInTheDocument());
    // The server stores a notification and pushes it (no session switch involved).
    act(() => {
      mockDb.update((db) => {
        db.notifications["ntf_live"] = {
          id: "ntf_live",
          recipientId: "usr_rafael",
          actorId: "usr_emma",
          type: "like",
          postId: "post_rafael_1",
          commentId: null,
          storyId: null,
          emoji: null,
          conversationId: null,
          messageId: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
      });
      publish({
        kind: "notification.created",
        notificationId: "ntf_live",
        recipientId: "usr_rafael",
      });
    });
    await waitFor(() => expect(within(link).getByText("6")).toBeInTheDocument());
  });
});
