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
    expect(screen.getByText("Reacted 😍 to your story.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
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

  it("confirms a follow request from its notification", async () => {
    const user = userEvent.setup();
    mockDb.update((db) => {
      const rafael = db.users["usr_rafael"];
      if (rafael) rafael.preferences.privacy.profileVisibility = "private";
      db.follows = db.follows.filter(
        (f) => !(f.followerId === "usr_emma" && f.followeeId === "usr_rafael"),
      );
      db.followRequests.push({
        followerId: "usr_emma",
        followeeId: "usr_rafael",
        createdAt: new Date().toISOString(),
      });
      db.notifications["ntf_request"] = {
        id: "ntf_request",
        recipientId: "usr_rafael",
        actorId: "usr_emma",
        type: "follow_request",
        postId: null,
        commentId: null,
        storyId: null,
        emoji: null,
        conversationId: null,
        messageId: null,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
    });
    renderApp("/notifications");
    expect(await screen.findByText("Requested to follow you.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(screen.queryByText("Requested to follow you.")).not.toBeInTheDocument(),
    );
    const db = mockDb.read();
    expect(
      db.follows.some((f) => f.followerId === "usr_emma" && f.followeeId === "usr_rafael"),
    ).toBe(true);
    expect(db.followRequests).toHaveLength(0);
  });

  it("opens the conversation from a new message notification", async () => {
    const user = userEvent.setup();
    renderApp("/notifications");
    await user.click(await screen.findByText("Sent you a message."));
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
