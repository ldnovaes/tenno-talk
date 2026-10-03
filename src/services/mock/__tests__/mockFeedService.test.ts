import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockFeedService } from "@/services/mock/implementations/mockFeedService";
import { mockTranslationService } from "@/services/mock/implementations/mockTranslationService";
import { writeMockSession } from "@/services/mock/session";

describe("mockFeedService", () => {
  beforeEach(() => writeMockSession("usr_lucas"));

  it("pages the feed newest first", async () => {
    const first = await mockFeedService.getFeed(null);
    expect(first.items).toHaveLength(5);
    const dates = first.items.map((p) => p.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    const all = [first];
    let cursor = first.nextCursor;
    while (cursor) {
      const next = await mockFeedService.getFeed(cursor);
      all.push(next);
      cursor = next.nextCursor;
    }
    expect(all.flatMap((p) => p.items)).toHaveLength(13);
  });

  it("projects captions in the viewer's language, keeping the original", async () => {
    const post = await mockFeedService.getPost("post_cam_1");
    expect(post.caption).toEqual({
      text: "Hoàng hôn ở Hồ Tây hôm nay đẹp quá 🌅",
      language: "vi-VN",
    });
    expect(post.captionTranslation).toMatchObject({
      status: "translated",
      text: "O pôr do sol no Lago Oeste hoje estava lindo demais 🌅",
    });
  });

  it("marks same-language captions as not needed (pt-PT → pt-BR)", async () => {
    const post = await mockFeedService.getPost("post_ana_1");
    expect(post.captionTranslation?.status).toBe("not_needed");
  });

  it("likes idempotently and notifies the author once", async () => {
    const before = await mockFeedService.getPost("post_yuki_1");
    await mockFeedService.like("post_yuki_1");
    const liked = await mockFeedService.like("post_yuki_1");
    expect(liked).toMatchObject({ likedByMe: true, likesCount: before.likesCount + 1 });
    const notifications = Object.values(mockDb.read().notifications).filter(
      (n) => n.recipientId === "usr_yuki",
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "like",
      actorId: "usr_lucas",
      postId: "post_yuki_1",
    });
    const unliked = await mockFeedService.unlike("post_yuki_1");
    expect(unliked).toMatchObject({ likedByMe: false, likesCount: before.likesCount });
  });

  it("does not notify yourself", async () => {
    await mockFeedService.like("post_lucas_1");
    expect(Object.values(mockDb.read().notifications)).toHaveLength(0);
  });

  it("adds comments in the author's language and lists them in order", async () => {
    const comment = await mockFeedService.addComment("post_yuki_1", "  Que lindo!  ");
    expect(comment.body).toEqual({ text: "Que lindo!", language: "pt-BR" });
    const comments = await mockFeedService.getComments("post_yuki_1");
    expect(comments.at(-1)?.id).toBe(comment.id);
    expect((await mockFeedService.getPost("post_yuki_1")).commentsCount).toBe(1);
  });

  it("enforces 'who can comment'", async () => {
    mockDb.update((db) => {
      const yuki = db.users["usr_yuki"];
      if (yuki) yuki.preferences.privacy.whoCanComment = "nobody";
    });
    await expect(mockFeedService.addComment("post_yuki_1", "Oi")).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(mockFeedService.addComment("post_lucas_1", "  ")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("hides posts of private profiles from non-followers and of blocked users", async () => {
    mockDb.update((db) => {
      const leo = db.users["usr_leo"];
      if (leo) leo.preferences.privacy.profileVisibility = "private";
      db.users["usr_omar"]?.blockedUserIds.push("usr_lucas");
    });
    await expect(mockFeedService.getPost("post_leo_1")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(mockFeedService.getPost("post_omar_1")).rejects.toMatchObject({
      code: "not_found",
    });
    expect((await mockFeedService.getUserPosts("usr_leo", null)).items).toEqual([]);
    mockDb.update((db) => {
      db.follows.push({
        followerId: "usr_lucas",
        followeeId: "usr_leo",
        createdAt: new Date().toISOString(),
      });
    });
    await expect(mockFeedService.getPost("post_leo_1")).resolves.toMatchObject({
      id: "post_leo_1",
    });
  });

  it("creates a post with upload progress", async () => {
    const progress = vi.fn();
    const post = await mockFeedService.createPost(
      {
        caption: "Novo post",
        media: [
          {
            kind: "image",
            url: "data:image/png;base64,AA",
            mimeType: "image/png",
            sizeBytes: 2,
            width: 1,
            height: 1,
            durationMs: null,
            fileName: "a.png",
          },
        ],
      },
      progress,
    );
    expect(post).toMatchObject({
      caption: { text: "Novo post", language: "pt-BR" },
      likesCount: 0,
    });
    expect(progress.mock.calls.map((call) => call[0])).toEqual([0.15, 0.4, 0.7, 0.9, 1]);
    expect((await mockFeedService.getFeed(null)).items[0]?.id).toBe(post.id);
  });

  it("refuses an empty post", async () => {
    await expect(mockFeedService.createPost({ caption: "x", media: [] })).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("translates content on demand and caches it", async () => {
    mockDb.update((db) => {
      const lucas = db.users["usr_lucas"];
      if (lucas) lucas.preferences.translation.receivingLanguage = "es-ES";
    });
    const before = await mockFeedService.getPost("post_cam_1");
    expect(before.captionTranslation).toBeNull();
    const translation = await mockTranslationService.translateContent(
      { kind: "post", id: "post_cam_1" },
      "es-ES",
    );
    expect(translation.status).toBe("translated");
    expect((await mockFeedService.getPost("post_cam_1")).captionTranslation?.text).toBe(
      translation.text,
    );
  });
});
