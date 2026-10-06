import { AppError } from "@/lib/errors";
import type { FeedService } from "@/services/feedService";
import type { MediaAttachment } from "@/types/media";

import { mockDb } from "../db";
import { publish } from "../events";
import { mockRequest, sleep } from "../latency";
import { addNotification } from "../notificationRecords";
import { canSeePosts, projectComment, projectPost } from "../postProjections";
import type { MockDatabase, PostRecord } from "../schema";
import { requireViewerId } from "../session";

const PAGE_SIZE = 5;

function page<T>(items: T[], cursor: string | null) {
  const start = cursor ? Number(cursor) : 0;
  const next = start + PAGE_SIZE;
  return { items: items.slice(start, next), nextCursor: next < items.length ? String(next) : null };
}

function newest(a: PostRecord, b: PostRecord) {
  return b.createdAt.localeCompare(a.createdAt);
}

function visiblePost(db: MockDatabase, postId: string, viewerId: string): PostRecord {
  const post = db.posts[postId];
  if (!post || !canSeePosts(db, post.authorId, viewerId))
    throw new AppError("not_found", "Post not found.");
  return post;
}

export const mockFeedService: FeedService = {
  getFeed(cursor) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const posts = Object.values(db.posts)
        .filter(
          (post) =>
            canSeePosts(db, post.authorId, viewerId) &&
            (post.authorId === viewerId ||
              db.follows.some((f) => f.followerId === viewerId && f.followeeId === post.authorId)),
        )
        .sort(newest)
        .map((post) => projectPost(db, post, viewerId));
      return page(posts, cursor);
    });
  },

  getUserPosts(userId, cursor) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      if (!canSeePosts(db, userId, viewerId)) return { items: [], nextCursor: null };
      const posts = Object.values(db.posts)
        .filter((post) => post.authorId === userId)
        .sort(newest)
        .map((post) => projectPost(db, post, viewerId));
      return page(posts, cursor);
    });
  },

  getPost(postId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      return projectPost(db, visiblePost(db, postId, viewerId), viewerId);
    });
  },

  async like(postId) {
    const viewerId = requireViewerId();
    const result = await mockRequest(() =>
      mockDb.update((db) => {
        const post = visiblePost(db, postId, viewerId);
        let notificationId: string | null = null;
        if (!post.likedBy.includes(viewerId)) {
          post.likedBy.push(viewerId);
          notificationId = addNotification(db, post.authorId, viewerId, "like", {
            postId: post.id,
          });
        }
        return {
          post: projectPost(db, post, viewerId),
          notificationId,
          recipientId: post.authorId,
        };
      }),
    );
    if (result.notificationId) {
      publish({
        kind: "notification.created",
        notificationId: result.notificationId,
        recipientId: result.recipientId,
      });
    }
    return result.post;
  },

  unlike(postId) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        const post = visiblePost(db, postId, viewerId);
        post.likedBy = post.likedBy.filter((id) => id !== viewerId);
        return projectPost(db, post, viewerId);
      }),
    );
  },

  getComments(postId, afterId, targetId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      visiblePost(db, postId, viewerId);
      const ordered = Object.values(db.comments)
        .filter(
          (comment) =>
            comment.postId === postId &&
            (!targetId || comment.id === targetId) &&
            !db.users[viewerId]?.blockedUserIds.includes(comment.authorId) &&
            !db.users[comment.authorId]?.blockedUserIds.includes(viewerId),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      // Like the backend: an unknown cursor (or one from another post) gives nothing, never the first page again.
      const position = afterId ? ordered.findIndex((c) => c.id === afterId) : -1;
      if (afterId && position === -1) return [];
      const start = position + 1;
      return ordered
        .slice(start, start + 50)
        .map((comment) => projectComment(db, comment, viewerId));
    });
  },

  async addComment(postId, text, clientId) {
    const viewerId = requireViewerId();
    const result = await mockRequest(() =>
      mockDb.update((db) => {
        const post = visiblePost(db, postId, viewerId);
        const viewer = db.users[viewerId];
        const author = db.users[post.authorId];
        if (!viewer || !author) throw new AppError("not_found", "Post not found.");
        const body = text.trim();
        if (!body) throw new AppError("validation", "A comment can't be empty.");
        // "Who can comment" is enforced by the server (PLAN.md §31).
        const audience = author.preferences.privacy.whoCanComment;
        const followedByAuthor = db.follows.some(
          (f) => f.followerId === author.id && f.followeeId === viewerId,
        );
        if (
          author.id !== viewerId &&
          (audience === "nobody" || (audience === "followers" && !followedByAuthor))
        ) {
          throw new AppError("forbidden", "Comments are limited on this post.");
        }
        const id = clientId ? `cmt_${viewerId}_${clientId}` : `cmt_${crypto.randomUUID()}`;
        const existing = db.comments[id];
        if (existing) {
          if (existing.postId !== postId)
            throw new AppError("conflict", "This comment id was already used.");
          return {
            comment: projectComment(db, existing, viewerId),
            notificationId: null,
            recipientId: post.authorId,
          };
        }
        db.comments[id] = {
          id,
          postId,
          authorId: viewerId,
          body: { text: body, language: viewer.nativeLanguage },
          translations: {},
          createdAt: new Date().toISOString(),
        };
        const comment = db.comments[id];
        if (!comment) throw new AppError("unknown", "Could not save the comment.");
        const notificationId = addNotification(db, post.authorId, viewerId, "comment", {
          postId,
          commentId: id,
        });
        return {
          comment: projectComment(db, comment, viewerId),
          notificationId,
          recipientId: post.authorId,
        };
      }),
    );
    if (result.notificationId) {
      publish({
        kind: "notification.created",
        notificationId: result.notificationId,
        recipientId: result.recipientId,
      });
    }
    return result.comment;
  },

  async createPost(input, onProgress) {
    const viewerId = requireViewerId();
    if (input.media.length === 0)
      throw new AppError("validation", "Add at least one photo or video.");
    // Simulated upload progress.
    for (const step of [0.15, 0.4, 0.7, 0.9]) {
      onProgress?.(step);
      await sleep(80);
    }
    const post = await mockRequest(() =>
      mockDb.update((db) => {
        const viewer = db.users[viewerId];
        if (!viewer) throw new AppError("unauthenticated", "Your session has expired.");
        const id = `post_${crypto.randomUUID()}`;
        const caption = input.caption.trim();
        const media: MediaAttachment[] = input.media.map((item, index) => ({
          id: `${id}_${index}`,
          kind: item.kind === "video" ? "video" : "image",
          url: item.url,
          thumbnailUrl: item.kind === "image" ? item.url : null,
          width: item.width,
          height: item.height,
          durationMs: item.durationMs,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          alt: null,
        }));
        db.posts[id] = {
          id,
          authorId: viewerId,
          media,
          caption: caption ? { text: caption, language: viewer.nativeLanguage } : null,
          captionTranslations: {},
          likedBy: [],
          createdAt: new Date().toISOString(),
        };
        const record = db.posts[id];
        if (!record) throw new AppError("unknown", "Could not publish.");
        return projectPost(db, record, viewerId);
      }),
    );
    onProgress?.(1);
    return post;
  },
};
