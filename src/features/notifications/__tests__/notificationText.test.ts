import { describe, expect, it } from "vitest";

import { i18n } from "@/app/i18n";
import { notificationDestination } from "@/features/notifications/lib/destination";
import { describeNotification } from "@/features/notifications/lib/notificationText";
import type { Notification, NotificationType } from "@/types/notification";

const base = {
  id: "n1",
  actor: { id: "a", username: "ana maria", displayName: "Ana", avatarUrl: null },
  createdAt: "2026-10-05T12:00:00.000Z",
  readAt: null,
};

/**
 * Every notification type (PLAN.md §36.2): the sentence shared by the list, the toast and the
 * server push, and where tapping it goes. Ids with reserved characters prove the URLs are encoded.
 */
const CASES: Record<
  NotificationType,
  { notification: Notification; text: string; to: string; overlay: boolean }
> = {
  like: {
    notification: { ...base, type: "like", postId: "p/1" },
    text: "Liked your post.",
    to: "/posts/p%2F1",
    overlay: true,
  },
  comment: {
    notification: { ...base, type: "comment", postId: "p1", commentId: "c&1" },
    text: "Commented on your post.",
    to: "/posts/p1?commentId=c%261",
    overlay: true,
  },
  follow: {
    notification: { ...base, type: "follow" },
    text: "Started following you.",
    to: "/u/ana%20maria",
    overlay: true,
  },
  follow_request: {
    notification: { ...base, type: "follow_request" },
    text: "Requested to follow you.",
    to: "/u/ana%20maria",
    overlay: true,
  },
  follow_accepted: {
    notification: { ...base, type: "follow_accepted" },
    text: "Accepted your follow request.",
    to: "/u/ana%20maria",
    overlay: true,
  },
  story_reaction: {
    notification: { ...base, type: "story_reaction", storyId: "s?1", emoji: "🔥" },
    text: "Reacted 🔥 to your story.",
    // The story is the viewer's own: the viewer's stories, opened at that one.
    to: "/stories/me?storyId=s%3F1",
    overlay: true,
  },
  new_message: {
    notification: { ...base, type: "new_message", conversationId: "c 1", messageId: "m#1" },
    text: "Sent you a message.",
    to: "/chats/c%201?messageId=m%231",
    overlay: false,
  },
};

describe.each(Object.entries(CASES))("%s", (_type, { notification, text, to, overlay }) => {
  it("describes what the actor did", () => {
    expect(describeNotification(notification, i18n.t)).toBe(text);
  });

  it("opens the right destination", () => {
    expect(notificationDestination(notification, "me")).toEqual({ to, overlay });
  });
});
