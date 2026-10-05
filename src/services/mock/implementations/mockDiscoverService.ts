import type { DiscoverService } from "@/services/discoverService";

import { mockDb } from "../db";
import { rankDiscover } from "../discoverRanking";
import { mockRequest } from "../latency";
import { canSeePosts, projectPost } from "../postProjections";
import type { PostRecord } from "../schema";
import { requireViewerId } from "../session";

const PAGE_SIZE = 5;

/** Ranked once per session and sliced, like the server, so pages never repeat (PLAN.md §37.6). */
const sessions = new Map<string, string[]>();

function parseCursor(cursor: string | null): { session: string; offset: number } | null {
  if (!cursor) return null;
  const [session, offset] = cursor.split(":");
  return session && offset ? { session, offset: Number(offset) || 0 } : null;
}

export const mockDiscoverService: DiscoverService = {
  getPosts(cursor) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const position = parseCursor(cursor);
      let session = position ? sessions.get(position.session) : undefined;
      let sessionId = position?.session ?? "";
      let offset = position?.offset ?? 0;
      if (!session || offset >= session.length) {
        const shown = new Set(session ?? []);
        sessionId = crypto.randomUUID();
        session = rankDiscover(db, viewerId, Date.now()).filter((id) => !shown.has(id));
        sessions.set(sessionId, session);
        offset = 0;
      }
      const end = Math.min(session.length, offset + PAGE_SIZE);
      const items = session
        .slice(offset, end)
        .map((id) => db.posts[id])
        .filter(
          (post): post is PostRecord =>
            post !== undefined && canSeePosts(db, post.authorId, viewerId),
        )
        .map((post) => projectPost(db, post, viewerId));
      return { items, nextCursor: session.length === 0 ? null : `${sessionId}:${end}` };
    });
  },

  trackEvents(events) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      mockDb.update((db) => {
        for (const event of events) {
          const post = db.posts[event.postId];
          if (!post || post.authorId === viewerId) continue;
          if (event.kind === "impression")
            db.discover.seen.push({ userId: viewerId, postId: post.id });
          if (event.kind === "hide_post")
            db.discover.hiddenPosts.push({ userId: viewerId, postId: post.id });
          if (event.kind === "hide_author") {
            db.discover.hiddenAuthors.push({ userId: viewerId, authorId: post.authorId });
          }
        }
      });
    });
  },

  unhidePost(postId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      mockDb.update((db) => {
        db.discover.hiddenPosts = db.discover.hiddenPosts.filter(
          (h) => !(h.userId === viewerId && h.postId === postId),
        );
      });
    });
  },

  unhideAuthor(authorId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      mockDb.update((db) => {
        db.discover.hiddenAuthors = db.discover.hiddenAuthors.filter(
          (h) => !(h.userId === viewerId && h.authorId === authorId),
        );
      });
    });
  },
};
