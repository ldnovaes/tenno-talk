import { describe, expect, it } from "vitest";

import {
  conversationAvatar,
  conversationTitle,
  filterConversations,
  isMuted,
  otherMember,
  totalUnread,
} from "@/features/chat/lib/conversationFilters";

import { makeConversation, makeMessage } from "@/test/factories";

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
