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
    mockDb.update((db) => {
      db.follows.push({
        followerId: "usr_rafael",
        followeeId: "usr_minh",
        createdAt: new Date().toISOString(),
      });
    });
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

  // Same cases as StoryReactionIT (PLAN.md §9.9).
  it("a reaction is a direct message to the author, not an extra notification", async () => {
    const { conversationId, message } = await mockStoryService.react("story_linh_1", "❤️");
    expect(conversationId).toBe("conv_rafael_linh");
    expect(message.content).toEqual({
      type: "story_reaction",
      storyId: "story_linh_1",
      emoji: "❤️",
    });
    expect(message.translation).toBeNull();
    const types = Object.values(mockDb.read().notifications)
      .filter((n) => n.recipientId === "usr_linh" && n.actorId === "usr_rafael")
      .map((n) => n.type);
    expect(types).not.toContain("story_reaction");
  });

  it("every tap is a new message, a retried tap is not", async () => {
    await mockStoryService.react("story_linh_1", "🔥", "tap-1");
    await mockStoryService.react("story_linh_1", "🔥", "tap-1");
    await mockStoryService.react("story_linh_1", "😂", "tap-2");
    const reactions = Object.values(mockDb.read().messages).filter(
      (m) => m.content.type === "story_reaction",
    );
    expect(reactions).toHaveLength(2);
  });

  it("you can't react to your own story, nor across messaging privacy", async () => {
    await expect(mockStoryService.react("story_rafael_1", "❤️")).rejects.toMatchObject({
      code: "validation",
    });
    mockDb.update((db) => {
      const linh = db.users["usr_linh"];
      if (linh) linh.preferences.privacy.whoCanMessage = "nobody";
    });
    await expect(mockStoryService.react("story_linh_1", "❤️")).rejects.toMatchObject({
      code: "forbidden",
    });
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
