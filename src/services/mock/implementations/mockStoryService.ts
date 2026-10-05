import { AppError } from "@/lib/errors";
import type { StoryService } from "@/services/storyService";
import type { Story, StoryTrayItem } from "@/types/story";

import { mockDb } from "../db";
import { publish } from "../events";
import { mockRequest } from "../latency";
import { addNotification } from "../notificationRecords";
import { toUser } from "../mappers";
import { canSeePosts, contentTranslationFor } from "../postProjections";
import type { MockDatabase, StoryRecord } from "../schema";
import { requireViewerId } from "../session";
import { mockChatService } from "./mockChatService";

function active(story: StoryRecord, now = Date.now()) {
  return new Date(story.expiresAt).getTime() > now;
}

function projectStory(db: MockDatabase, story: StoryRecord, viewerId: string): Story {
  const author = db.users[story.authorId];
  const target = db.users[viewerId]?.preferences.translation.receivingLanguage;
  return {
    id: story.id,
    author: author
      ? toUser(author)
      : { id: story.authorId, username: "", displayName: "", avatarUrl: null },
    media: story.media,
    overlayText: story.overlayText,
    overlayTranslation: contentTranslationFor(
      story.overlayText,
      story.overlayTranslations,
      target,
      story.createdAt,
    ),
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    viewedByMe: story.viewedBy.includes(viewerId),
  };
}

function visibleStory(db: MockDatabase, storyId: string, viewerId: string): StoryRecord {
  const story = db.stories[storyId];
  if (!story || !active(story) || !canSeePosts(db, story.authorId, viewerId)) {
    throw new AppError("not_found", "This story is no longer available.");
  }
  return story;
}

export const mockStoryService: StoryService = {
  getUserStories(userId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      return Object.values(db.stories)
        .filter(
          (story) =>
            story.authorId === userId && active(story) && canSeePosts(db, userId, viewerId),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((story) => projectStory(db, story, viewerId));
    });
  },
  getStory(storyId) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      return projectStory(db, visibleStory(db, storyId, viewerId), viewerId);
    });
  },
  getTray() {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const byAuthor = new Map<string, StoryRecord[]>();
      for (const story of Object.values(db.stories)) {
        if (!active(story) || !canSeePosts(db, story.authorId, viewerId)) continue;
        if (
          story.authorId !== viewerId &&
          !db.follows.some((f) => f.followerId === viewerId && f.followeeId === story.authorId)
        )
          continue;
        byAuthor.set(story.authorId, [...(byAuthor.get(story.authorId) ?? []), story]);
      }
      const tray: StoryTrayItem[] = [];
      for (const [authorId, stories] of byAuthor) {
        const author = db.users[authorId];
        if (!author) continue;
        const projected = stories
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((story) => projectStory(db, story, viewerId));
        tray.push({
          user: toUser(author),
          stories: projected,
          hasUnseen: projected.some((s) => !s.viewedByMe),
        });
      }
      const latest = (item: StoryTrayItem) => item.stories.at(-1)?.createdAt ?? "";
      return tray.sort((a, b) => {
        if (a.user.id === viewerId) return -1;
        if (b.user.id === viewerId) return 1;
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
        return latest(b).localeCompare(latest(a));
      });
    });
  },

  markViewed(storyId) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        const story = visibleStory(db, storyId, viewerId);
        if (!story.viewedBy.includes(viewerId)) story.viewedBy.push(viewerId);
      }),
    );
  },

  async react(storyId, emoji) {
    const viewerId = requireViewerId();
    const result = await mockRequest(() =>
      mockDb.update((db) => {
        const story = visibleStory(db, storyId, viewerId);
        story.reactions.push({ userId: viewerId, emoji });
        const id = addNotification(db, story.authorId, viewerId, "story_reaction", {
          storyId,
          emoji,
        });
        return id ? { id, recipientId: story.authorId } : null;
      }),
    );
    if (result)
      publish({
        kind: "notification.created",
        notificationId: result.id,
        recipientId: result.recipientId,
      });
  },

  async reply(storyId, text, clientId = crypto.randomUUID()) {
    const viewerId = requireViewerId();
    const db = mockDb.read();
    const story = visibleStory(db, storyId, viewerId);
    if (story.authorId === viewerId)
      throw new AppError("validation", "You can't reply to your own story.");
    const conversation = await mockChatService.getOrCreateDirectConversation(story.authorId);
    const message = await mockChatService.sendMessage({
      conversationId: conversation.id,
      clientId,
      text,
      media: [],
      replyToId: null,
    });
    // Turn the text message into a story reply (keeps the story reference).
    mockDb.update((state) => {
      const record = state.messages[message.id];
      if (record && record.content.type === "text") {
        record.content = { type: "story_reply", storyId, body: record.content.body };
      }
    });
    publish({ kind: "message.updated", conversationId: conversation.id, messageId: message.id });
    return { conversationId: conversation.id };
  },

  createStory({ media, text }) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewerId = requireViewerId();
        const viewer = db.users[viewerId];
        if (!viewer) throw new AppError("unauthenticated", "Your session has expired.");
        const id = `story_${crypto.randomUUID()}`;
        const now = new Date();
        const overlay = text.trim();
        db.stories[id] = {
          id,
          authorId: viewerId,
          media: {
            id: `${id}_media`,
            kind: media.kind === "video" ? "video" : "image",
            url: media.url,
            thumbnailUrl: media.kind === "image" ? media.url : null,
            width: media.width,
            height: media.height,
            durationMs: media.durationMs,
            mimeType: media.mimeType,
            sizeBytes: media.sizeBytes,
            alt: null,
          },
          overlayText: overlay ? { text: overlay, language: viewer.nativeLanguage } : null,
          overlayTranslations: {},
          viewedBy: [viewerId],
          reactions: [],
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 24 * 3600_000).toISOString(),
        };
        const record = db.stories[id];
        if (!record) throw new AppError("unknown", "Could not publish the story.");
        return projectStory(db, record, viewerId);
      }),
    );
  },
};
