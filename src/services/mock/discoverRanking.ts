import { isSameLanguage } from "@/lib/languages";

import { canSeePosts } from "./postProjections";
import type { MockDatabase, PostRecord } from "./schema";

const HOUR = 3_600_000;
const HASHTAG = /#([\p{L}\p{M}\p{N}_]+)/gu;

function hashtags(post: PostRecord): string[] {
  return [...(post.caption?.text.matchAll(HASHTAG) ?? [])].map((match) =>
    (match[1] ?? "").toLowerCase(),
  );
}

/**
 * The mock's stand-in for the server ranking (PLAN.md §37.4), with the same rules that matter to the UI:
 * own, hidden and invisible posts never appear; languages the viewer learns, hashtags of posts they liked
 * and people they follow come first; seen posts go back. Ties: newest, then id.
 */
export function rankDiscover(db: MockDatabase, viewerId: string, now: number): string[] {
  const viewer = db.users[viewerId];
  if (!viewer) return [];
  const hiddenPosts = new Set(
    db.discover.hiddenPosts.filter((h) => h.userId === viewerId).map((h) => h.postId),
  );
  const hiddenAuthors = new Set(
    db.discover.hiddenAuthors.filter((h) => h.userId === viewerId).map((h) => h.authorId),
  );
  const seen = new Set(db.discover.seen.filter((s) => s.userId === viewerId).map((s) => s.postId));
  const following = new Set(
    db.follows.filter((f) => f.followerId === viewerId).map((f) => f.followeeId),
  );
  const likedTags = new Set(
    Object.values(db.posts)
      .filter((post) => post.likedBy.includes(viewerId))
      .flatMap(hashtags),
  );
  const learns = (language: string | undefined) =>
    language !== undefined &&
    viewer.learningLanguages.some((code) => isSameLanguage(code, language));

  const score = (post: PostRecord) => {
    const author = db.users[post.authorId];
    const ageHours = Math.max(0, (now - Date.parse(post.createdAt)) / HOUR);
    let value = 2 ** (-ageHours / 24);
    if (learns(post.caption?.language) || learns(author?.nativeLanguage)) value += 1.5;
    if (hashtags(post).some((tag) => likedTags.has(tag))) value += 3;
    if (following.has(post.authorId)) value += 1.5;
    if (seen.has(post.id)) value -= 2;
    return value;
  };

  return Object.values(db.posts)
    .filter(
      (post) =>
        post.authorId !== viewerId &&
        !hiddenPosts.has(post.id) &&
        !hiddenAuthors.has(post.authorId) &&
        canSeePosts(db, post.authorId, viewerId),
    )
    .map((post) => ({ post, score: score(post) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.createdAt.localeCompare(a.post.createdAt) ||
        a.post.id.localeCompare(b.post.id),
    )
    .map(({ post }) => post.id);
}
