import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { publish } from "@/services/mock/events";
import { setViewportWidth } from "@/test/setup";
import { renderApp, signInAs } from "@/test/utils";

/** The number shown on a navigation link (0 when there is no badge). */
function badgeOf(link: HTMLElement): number {
  const badge = within(link).queryByText(/^\d+$/);
  return badge ? Number(badge.textContent) : 0;
}

function navLink(name: RegExp) {
  return within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", {
    name,
  });
}

/**
 * Linh's message reaches Rafael's tab the way the server delivers it. Written straight to the
 * mock backend: switching the mock session to Linh would make Rafael's own refetches run as her.
 */
function linhSends(text: string) {
  const id = `msg_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  act(() => {
    mockDb.update((db) => {
      db.messages[id] = {
        id,
        clientId: id,
        conversationId: "conv_rafael_linh",
        senderId: "usr_linh",
        content: { type: "text", body: { text, language: "vi-VN" } },
        translations: {},
        literals: {},
        replyToId: null,
        reactions: [],
        statusOverride: null,
        receipts: { usr_rafael: false },
        createdAt,
      };
      const conversation = db.conversations["conv_rafael_linh"];
      if (conversation) conversation.updatedAt = createdAt;
      db.notifications[`ntf_${id}`] = {
        id: `ntf_${id}`,
        recipientId: "usr_rafael",
        actorId: "usr_linh",
        type: "new_message",
        conversationId: "conv_rafael_linh",
        messageId: id,
        postId: null,
        commentId: null,
        storyId: null,
        emoji: null,
        readAt: null,
        createdAt,
      };
    });
    publish({
      kind: "notification.created",
      notificationId: `ntf_${id}`,
      recipientId: "usr_rafael",
    });
    publish({ kind: "message.created", conversationId: "conv_rafael_linh", messageId: id });
  });
}

describe("live badges when a message arrives", () => {
  beforeEach(() => signInAs("usr_rafael"));

  it("raises the Chats and Notifications badges on the rail outside the chat", async () => {
    setViewportWidth(1280);
    renderApp("/discover");
    await screen.findByText("Sofía Martínez");
    await waitFor(() => expect(badgeOf(navLink(/^Chats$/))).toBeGreaterThan(0));
    const chats = badgeOf(navLink(/^Chats$/));
    const notifications = badgeOf(navLink(/^Notifications$/));

    linhSends("Chào anh!");

    await waitFor(() => expect(badgeOf(navLink(/^Chats$/))).toBe(chats + 1));
    await waitFor(() => expect(badgeOf(navLink(/^Notifications$/))).toBe(notifications + 1));
  });

  it("raises the Chats badge on the mobile tab bar", async () => {
    setViewportWidth(390);
    renderApp("/feed");
    await waitFor(() => expect(badgeOf(navLink(/Chats/))).toBeGreaterThan(0));
    const chats = badgeOf(navLink(/Chats/));

    linhSends("Chào anh!");

    await waitFor(() => expect(badgeOf(navLink(/Chats/))).toBe(chats + 1));
  });

  it("raises the conversation's own unread count in the list", async () => {
    setViewportWidth(1280);
    renderApp("/chats");
    const list = await screen.findByRole("list", { name: "Chats" });
    const row = within(list).getByRole("link", { name: /Linh Pham/ });
    const before = badgeOf(row);

    linhSends("Chào anh!");

    await waitFor(() => expect(badgeOf(row)).toBe(before + 1));
  });
});
