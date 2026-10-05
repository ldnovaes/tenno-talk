import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { rankDiscover } from "@/services/mock/discoverRanking";
import { mockDiscoverService } from "@/services/mock/implementations/mockDiscoverService";
import { writeMockSession } from "@/services/mock/session";

const VIEWER = "usr_rafael";

async function scrollAll(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 20; guard++) {
    const page = await mockDiscoverService.getPosts(cursor);
    ids.push(...page.items.map((post) => post.id));
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error("Discover never ended");
}

describe("mock discover", () => {
  beforeEach(() => {
    mockDb.reset();
    writeMockSession(VIEWER);
  });

  it("shows every visible post of others once, then ends", async () => {
    const ids = await scrollAll();
    const db = mockDb.read();
    const others = Object.values(db.posts).filter((post) => post.authorId !== VIEWER);
    expect(ids).not.toContain("post_rafael_1");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(others.length);
  });

  it("never shows hidden posts, hidden authors or blocked people", async () => {
    await mockDiscoverService.trackEvents([
      { clientId: "1", postId: "post_sofia_1", kind: "hide_post", at: new Date().toISOString() },
      { clientId: "2", postId: "post_linh_1", kind: "hide_author", at: new Date().toISOString() },
    ]);
    mockDb.update((db) => db.users[VIEWER]?.blockedUserIds.push("usr_yuki"));
    const ids = await scrollAll();
    const db = mockDb.read();
    for (const id of ids) {
      expect(id).not.toBe("post_sofia_1");
      expect(db.posts[id]?.authorId).not.toBe("usr_linh");
      expect(db.posts[id]?.authorId).not.toBe("usr_yuki");
    }

    await mockDiscoverService.unhideAuthor("usr_linh");
    await mockDiscoverService.unhidePost("post_sofia_1");
    expect(await scrollAll()).toEqual(expect.arrayContaining(["post_sofia_1", "post_linh_1"]));
  });

  it("puts seen posts behind new ones", () => {
    const before = rankDiscover(mockDb.read(), VIEWER, Date.now());
    const first = before[0] ?? "";
    mockDb.update((db) => db.discover.seen.push({ userId: VIEWER, postId: first }));
    const after = rankDiscover(mockDb.read(), VIEWER, Date.now());
    expect(after.indexOf(first)).toBeGreaterThan(0);
  });

  it("favors hashtags of posts the viewer liked", () => {
    const now = Date.now();
    mockDb.update((db) => db.posts["post_emma_1"]?.likedBy.push(VIEWER));
    const before = rankDiscover(mockDb.read(), VIEWER, now).indexOf("post_leo_1");
    mockDb.update((db) => {
      const liked = db.posts["post_emma_1"];
      const similar = db.posts["post_leo_1"];
      if (!liked?.caption || !similar?.caption) throw new Error("seed changed");
      liked.caption.text += " #ramen";
      similar.caption.text += " #Ramen";
    });
    const after = rankDiscover(mockDb.read(), VIEWER, now).indexOf("post_leo_1");
    expect(before).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });
});
