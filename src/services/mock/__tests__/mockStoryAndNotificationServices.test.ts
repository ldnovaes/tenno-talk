import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockFeedService } from "@/services/mock/implementations/mockFeedService";
import { mockNotificationService } from "@/services/mock/implementations/mockNotificationService";
import { mockStoryService } from "@/services/mock/implementations/mockStoryService";
import { writeMockSession } from "@/services/mock/session";
import { mockRealtimeClient } from "@/services/realtime/mockRealtimeClient";

describe("mockStoryService", () => {
  beforeEach(() => writeMockSession("usr_rafael"));

  it("lists the viewer first, then unseen, then seen", async () => {
    const tray = await mockStoryService.getTray();
    expect(tray[0]?.user.id).toBe("usr_rafael");
    const others = tray.slice(1);
    const firstSeen = others.findIndex((item) => !item.hasUnseen);
    expect(others.slice(firstSeen).every((item) => !item.hasUnseen)).toBe(true);
    expect(others.find((item) => item.user.id === "usr_minh")?.hasUnseen).toBe(false);
    expect(tray.find((item) => item.user.id === "usr_linh")?.stories.map((s) => s.id)).toEqual([
      "story_linh_1",
      "story_linh_2",
    ]);
  });

  it("translates the overlay text for the viewer", async () => {
    const linh = (await mockStoryService.getTray()).find((item) => item.user.id === "usr_linh");
    expect(linh?.stories[0]?.overlayText).toEqual({
      text: "Cà phê trứng buổi sáng ☕",
      language: "vi-VN",
    });
    expect(linh?.stories[0]?.overlayTranslation?.text).toBe("Café com ovo de manhã ☕");
  });

  it("marks stories as viewed", async () => {
    await mockStoryService.markViewed("story_sofia_1");
    const sofia = (await mockStoryService.getTray()).find((item) => item.user.id === "usr_sofia");
    expect(sofia?.hasUnseen).toBe(false);
  });

  it("hides expired stories and stories of people who blocked the viewer", async () => {
    mockDb.update((db) => {
      const emma = db.stories["story_emma_1"];
      if (emma) emma.expiresAt = new Date(Date.now() - 1000).toISOString();
      db.users["usr_sofia"]?.blockedUserIds.push("usr_rafael");
    });
    const ids = (await mockStoryService.getTray()).map((item) => item.user.id);
    expect(ids).not.toContain("usr_emma");
    expect(ids).not.toContain("usr_sofia");
    await expect(mockStoryService.markViewed("story_emma_1")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("reacts and notifies the author", async () => {
    await mockStoryService.react("story_linh_1", "❤️");
    const notification = Object.values(mockDb.read().notifications).find(
      (n) =>
        n.recipientId === "usr_linh" && n.type === "story_reaction" && n.storyId === "story_linh_1",
    );
    expect(notification).toMatchObject({ actorId: "usr_rafael", emoji: "❤️" });
  });

  it("replies with a direct message that references the story", async () => {
    const { conversationId } = await mockStoryService.reply("story_linh_1", "Que delícia!");
    expect(conversationId).toBe("conv_rafael_linh");
    const message = Object.values(mockDb.read().messages).find(
      (m) => m.content.type === "story_reply" && m.content.storyId === "story_linh_1",
    );
    expect(message?.senderId).toBe("usr_rafael");
    await expect(mockStoryService.reply("story_rafael_1", "eu")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("creates a story that expires in 24 hours", async () => {
    const story = await mockStoryService.createStory({
      media: {
        kind: "image",
        url: "data:image/png;base64,AA",
        mimeType: "image/png",
        sizeBytes: 2,
        width: 1,
        height: 1,
        durationMs: null,
        fileName: "s.png",
      },
      text: "Bom dia",
    });
    expect(new Date(story.expiresAt).getTime() - new Date(story.createdAt).getTime()).toBe(
      24 * 3600_000,
    );
    const own = (await mockStoryService.getTray())[0];
    expect(own?.stories.at(-1)?.id).toBe(story.id);
  });
});

describe("mockNotificationService", () => {
  beforeEach(() => writeMockSession("usr_rafael"));

  it("lists the viewer's notifications newest first", async () => {
    const list = await mockNotificationService.list();
    expect(list.map((n) => n.type)).toEqual([
      "story_reaction",
      "new_message",
      "comment",
      "like",
      "like",
      "follow",
    ]);
    expect(list.every((n, i) => i === 0 || (list[i - 1]?.createdAt ?? "") >= n.createdAt)).toBe(
      true,
    );
  });

  it("counts unread and marks all as read", async () => {
    expect(await mockNotificationService.unreadCount()).toBe(5);
    await mockNotificationService.markAllRead();
    expect(await mockNotificationService.unreadCount()).toBe(0);
  });

  it("hides notifications from blocked people", async () => {
    mockDb.update((db) => {
      db.users["usr_rafael"]?.blockedUserIds.push("usr_linh");
    });
    const list = await mockNotificationService.list();
    expect(list.some((n) => n.actor.id === "usr_linh")).toBe(false);
  });

  it("pushes new notifications only to their recipient", async () => {
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const received = vi.fn();
    const stop = mockRealtimeClient.subscribe("notification.created", received);
    writeMockSession("usr_emma");
    await mockFeedService.like("post_rafael_1");
    await mockFeedService.like("post_linh_1");
    expect(received).toHaveBeenCalledTimes(1);
    expect(received.mock.calls[0]?.[0].notification).toMatchObject({
      type: "like",
      postId: "post_rafael_1",
    });
    stop();
    mockRealtimeClient.disconnect();
  });
});
