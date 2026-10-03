import { isSameLanguage } from "@/lib/languages";
import type { ContentTranslation, OriginalText } from "@/types/message";
import type { Comment, Post } from "@/types/post";

import { toUser } from "./mappers";
import type { CommentRecord, MockDatabase, PostRecord } from "./schema";

/** Viewer's translation if the server already has it; otherwise the client asks on demand. */
export function contentTranslationFor(
  original: OriginalText | null,
  translations: Record<string, ContentTranslation>,
  target: string | undefined,
  createdAt: string,
): ContentTranslation | null {
  if (!original || !target) return null;
  if (isSameLanguage(original.language, target)) {
    return {
      targetLanguage: target,
      text: null,
      status: "not_needed",
      version: 0,
      updatedAt: createdAt,
    };
  }
  return translations[target] ?? null;
}

export function projectPost(db: MockDatabase, post: PostRecord, viewerId: string): Post {
  const author = db.users[post.authorId];
  const target = db.users[viewerId]?.preferences.translation.receivingLanguage;
  return {
    id: post.id,
    author: author
      ? toUser(author)
      : { id: post.authorId, username: "", displayName: "", avatarUrl: null },
    media: structuredClone(post.media),
    caption: post.caption,
    captionTranslation: contentTranslationFor(
      post.caption,
      post.captionTranslations,
      target,
      post.createdAt,
    ),
    likesCount: post.likedBy.length,
    commentsCount: Object.values(db.comments).filter((c) => c.postId === post.id).length,
    likedByMe: post.likedBy.includes(viewerId),
    createdAt: post.createdAt,
  };
}

export function projectComment(
  db: MockDatabase,
  comment: CommentRecord,
  viewerId: string,
): Comment {
  const author = db.users[comment.authorId];
  const target = db.users[viewerId]?.preferences.translation.receivingLanguage;
  return {
    id: comment.id,
    postId: comment.postId,
    author: author
      ? toUser(author)
      : { id: comment.authorId, username: "", displayName: "", avatarUrl: null },
    body: comment.body,
    translation: contentTranslationFor(
      comment.body,
      comment.translations,
      target,
      comment.createdAt,
    ),
    createdAt: comment.createdAt,
  };
}

/** Posts visible to the viewer: blocks both ways and private profiles (followers only). */
export function canSeePosts(db: MockDatabase, authorId: string, viewerId: string): boolean {
  if (authorId === viewerId) return true;
  const author = db.users[authorId];
  const viewer = db.users[viewerId];
  if (!author || !viewer) return false;
  if (author.blockedUserIds.includes(viewerId) || viewer.blockedUserIds.includes(authorId))
    return false;
  if (author.preferences.privacy.profileVisibility === "private") {
    return db.follows.some((f) => f.followerId === viewerId && f.followeeId === authorId);
  }
  return true;
}
