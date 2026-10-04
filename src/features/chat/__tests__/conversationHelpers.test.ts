import { describe, expect, it } from "vitest";

import {
  conversationAvatar,
  conversationTitle,
  filterConversations,
  isMuted,
  otherMember,
  totalUnread,
} from "@/features/chat/lib/conversationFilters";
import { presenceLabel } from "@/features/chat/lib/presenceLabel";
import { displayTextFor, previewText } from "@/features/chat/lib/previewText";

import { makeConversation, makeMessage } from "./fixtures";

const labels = {
  you: (text: string) => `You: ${text}`,
  media: { photo: "📷 Photo", video: "🎬 Video", audio: "🎤 Voice", file: "📎 File" },
};

describe("conversation helpers", () => {
  const direct = makeConversation();
  const group = makeConversation({ id: "g", kind: "group", title: "Travel", unreadCount: 2 });

  it("resolves title and avatar", () => {
    expect(otherMember(direct, "me")?.user.id).toBe("linh");
    expect(conversationTitle(direct, "me")).toBe("Linh Pham");
    expect(conversationTitle(group, "me")).toBe("Travel");
    expect(otherMember(group, "me")).toBeNull();
    expect(conversationAvatar(group, "me").displayName).toBe("Travel");
  });

  it("filters by unread, groups and query (name, username, message text)", () => {
    const withMessage = makeConversation({
      id: "c3",
      unreadCount: 1,
      lastMessage: makeMessage({
        content: { type: "text", body: { text: "phở tonight?", language: "en-US" } },
      }),
    });
    const list = [direct, group, withMessage];
    expect(
      filterConversations(list, { filter: "unread", query: "", viewerId: "me" }).map((c) => c.id),
    ).toEqual(["g", "c3"]);
    expect(
      filterConversations(list, { filter: "groups", query: "", viewerId: "me" }).map((c) => c.id),
    ).toEqual(["g"]);
    expect(
      filterConversations(list, { filter: "all", query: "@linh", viewerId: "me" }),
    ).toHaveLength(2);
    expect(
      filterConversations(list, { filter: "all", query: "PHỞ", viewerId: "me" }).map((c) => c.id),
    ).toEqual(["c3"]);
  });

  it("sums unread except muted conversations", () => {
    const muted = makeConversation({
      id: "m",
      unreadCount: 5,
      mutedUntil: "9999-01-01T00:00:00.000Z",
    });
    expect(isMuted(muted)).toBe(true);
    expect(isMuted(makeConversation({ mutedUntil: "2000-01-01T00:00:00.000Z" }))).toBe(false);
    expect(totalUnread([group, muted, makeConversation({ unreadCount: 1 })])).toBe(3);
  });
});

describe("previews", () => {
  it("shows the translation of received messages once ready", () => {
    const message = makeMessage({
      senderId: "linh",
      content: { type: "text", body: { text: "Anh nhớ em", language: "vi-VN" } },
      translation: {
        targetLanguage: "pt-BR",
        text: "Saudade",
        status: "translated",
        version: 1,
        updatedAt: "",
      },
    });
    expect(displayTextFor(message, "me")).toBe("Saudade");
    expect(previewText(message, "me", labels)).toBe("Saudade");
  });

  it("falls back to the original while translating, and keeps own originals", () => {
    const pending = makeMessage({
      senderId: "linh",
      content: { type: "text", body: { text: "Anh nhớ em", language: "vi-VN" } },
      translation: {
        targetLanguage: "pt-BR",
        text: null,
        status: "translating",
        version: 0,
        updatedAt: "",
      },
    });
    expect(displayTextFor(pending, "me")).toBe("Anh nhớ em");
    const own = makeMessage({
      translation: {
        targetLanguage: "vi-VN",
        text: "x",
        status: "translated",
        version: 1,
        updatedAt: "",
      },
    });
    expect(previewText(own, "me", labels)).toBe(
      `You: ${own.content.type === "text" ? own.content.body.text : ""}`,
    );
  });

  it("labels media", () => {
    const image = makeMessage({
      senderId: "linh",
      content: { type: "image", media: [], caption: null },
    });
    expect(previewText(image, "me", labels)).toBe("📷 Photo");
    const captioned = makeMessage({
      senderId: "linh",
      content: { type: "image", media: [], caption: { text: "Lake", language: "en-US" } },
    });
    expect(previewText(captioned, "me", labels)).toBe("📷 Photo · Lake");
  });
});

describe("presenceLabel", () => {
  const now = new Date(2026, 9, 3, 12, 0);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  it("covers online, just now, minutes, hours, dates and unknown", () => {
    expect(presenceLabel({ isOnline: true, lastSeenAt: null }, now)).toEqual({ kind: "online" });
    expect(presenceLabel({ isOnline: false, lastSeenAt: ago(0) }, now)).toEqual({
      kind: "justNow",
    });
    expect(presenceLabel({ isOnline: false, lastSeenAt: ago(5) }, now)).toEqual({
      kind: "minutes",
      count: 5,
    });
    expect(presenceLabel({ isOnline: false, lastSeenAt: ago(125) }, now)).toEqual({
      kind: "hours",
      count: 2,
    });
    expect(presenceLabel({ isOnline: false, lastSeenAt: ago(60 * 24 * 3) }, now).kind).toBe("date");
    expect(presenceLabel({ isOnline: false, lastSeenAt: null }, now)).toEqual({ kind: "unknown" });
  });
});
