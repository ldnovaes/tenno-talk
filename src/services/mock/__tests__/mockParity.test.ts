import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { onServerEvent, publish, type ServerEvent } from "@/services/mock/events";
import { mockAdminService } from "@/services/mock/implementations/mockAdminService";
import {
  acknowledgeDelivery,
  mockChatService,
} from "@/services/mock/implementations/mockChatService";
import { mockFeedService } from "@/services/mock/implementations/mockFeedService";
import { mockModerationService } from "@/services/mock/implementations/mockModerationService";
import { mockNotificationService } from "@/services/mock/implementations/mockNotificationService";
import { writeMockSession } from "@/services/mock/session";
import { mockRealtimeClient } from "@/services/realtime/mockRealtimeClient";

/**
 * Behaviour the mock must share with the Java backend (PLAN.md §16: components never know which one runs).
 * Each case mirrors a backend rule and names the backend test that pins it.
 */
afterEach(() => mockRealtimeClient.disconnect());

const CONVERSATION = "conv_rafael_linh";

function block(blocker: string, blocked: string) {
  mockDb.update((db) => {
    db.users[blocker]?.blockedUserIds.push(blocked);
  });
}

async function send(senderId: string, text: string, clientId: string) {
  writeMockSession(senderId);
  return mockChatService.sendMessage({
    conversationId: CONVERSATION,
    clientId,
    text,
    media: [],
    replyToId: null,
  });
}

describe("notifications (NotificationMatrixIT, RealtimeWebSocketIT)", () => {
  it("reading all of them tells the other tabs, like reading some", async () => {
    writeMockSession("usr_rafael");
    const events: ServerEvent[] = [];
    const stop = onServerEvent((event) => events.push(event));
    await mockNotificationService.markAllRead();
    stop();
    expect(events).toContainEqual({ kind: "notifications.read", recipientId: "usr_rafael" });
  });

  it("a cursor that isn't in your list gives nothing (no restart from the top)", async () => {
    writeMockSession("usr_rafael");
    expect(await mockNotificationService.list("not-mine")).toEqual([]);
  });
});

describe("admin pages (SecurityMatrixIT: 403 for non-admins)", () => {
  it.each([
    ["getAiStatus", () => mockAdminService.getAiStatus()],
    ["checkProvider", () => mockAdminService.checkProvider("openai")],
    ["listReports", () => mockAdminService.listReports("open")],
    ["resolveReport", () => mockAdminService.resolveReport("r1", "dismissed")],
  ])("%s is refused to a regular user", async (_name, call) => {
    writeMockSession("usr_linh");
    await expect(call()).rejects.toMatchObject({ code: "forbidden" });
  });

  it("an admin is served", async () => {
    writeMockSession("usr_rafael");
    await expect(mockAdminService.getAiStatus()).resolves.toMatchObject({
      providers: expect.any(Array),
    });
  });
});

describe("realtime between a blocked pair (RealtimeWebSocketIT, PLAN.md §31.1)", () => {
  it("no typing, reactions or receipts cross a block", async () => {
    const message = await send("usr_rafael", "Oi", "before-block");
    block("usr_linh", "usr_rafael");
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const received = vi.fn();
    for (const type of [
      "typing.started",
      "reaction.created",
      "message.read",
      "message.delivered",
      "message.updated",
    ] as const)
      mockRealtimeClient.subscribe(type, (payload) => received(type, payload));

    // Linh acts from her own device while Rafael's client listens.
    writeMockSession("usr_linh");
    publish({ kind: "typing", conversationId: CONVERSATION, userId: "usr_linh", isTyping: true });
    await expect(mockChatService.react(message.id, "❤️")).rejects.toMatchObject({
      code: "forbidden",
    });
    await mockChatService.markAsRead(CONVERSATION, message.id);
    acknowledgeDelivery("usr_linh", CONVERSATION, message.id);

    expect(received.mock.calls.map((call) => call[0])).toEqual([]);
  });

  it("the read mark of a blocked reader never reaches the sender, also after a refetch", async () => {
    const message = await send("usr_rafael", "Oi", "read-across-block");
    block("usr_linh", "usr_rafael");
    writeMockSession("usr_linh");
    await mockChatService.markAsRead(CONVERSATION, message.id);

    writeMockSession("usr_rafael");
    const page = await mockChatService.getMessages(CONVERSATION, null);
    const mine = page.items.find((item) => item.id === message.id);
    expect(mine?.deliveryStatus).not.toBe("read");

    writeMockSession("usr_linh");
    const conversation = await mockChatService.getConversation(CONVERSATION);
    expect(conversation.unreadCount).toBe(0);
  });
});

describe("comments (SocialDeliveryIT: afterId)", () => {
  it("a cursor that isn't a comment of this post gives nothing", async () => {
    writeMockSession("usr_rafael");
    const post = Object.values(mockDb.read().posts)[0];
    if (!post) throw new Error("seed has posts");
    expect(await mockFeedService.getComments(post.id, "not-a-comment")).toEqual([]);
  });
});

describe("reports (ReportsIT, ModerationEdgesIT)", () => {
  it("you can't report your own content, of any kind", async () => {
    writeMockSession("usr_rafael");
    const own = Object.values(mockDb.read().posts).find((p) => p.authorId === "usr_rafael");
    if (!own) throw new Error("seed has a post by rafael");
    await expect(
      mockModerationService.report({ kind: "post", id: own.id }, "spam"),
    ).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("only what you can see can be reported", async () => {
    writeMockSession("usr_rafael");
    const hidden = Object.values(mockDb.read().posts).find((p) => p.authorId === "usr_linh");
    if (!hidden) throw new Error("seed has a post by linh");
    block("usr_linh", "usr_rafael");
    await expect(
      mockModerationService.report({ kind: "post", id: hidden.id }, "spam"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      mockModerationService.report({ kind: "message", id: "nope" }, "spam"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("reporting the same thing twice keeps one open report", async () => {
    writeMockSession("usr_rafael");
    await mockModerationService.report({ kind: "user", id: "usr_omar" }, "spam");
    await mockModerationService.report({ kind: "user", id: "usr_omar" }, "hate");
    writeMockSession("usr_rafael");
    const open = (await mockAdminService.listReports("open")).filter(
      (r) => r.targetId === "usr_omar",
    );
    expect(open).toHaveLength(1);
  });
});
