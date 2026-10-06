import { describe, expect, it } from "vitest";

import { adminService } from "@/services/adminService";
import { chatService } from "@/services/chatService";
import { discoverService } from "@/services/discoverService";
import { feedService } from "@/services/feedService";
import { moderationService } from "@/services/moderationService";
import { notificationService } from "@/services/notificationService";
import { profileService } from "@/services/profileService";
import { storyService } from "@/services/storyService";
import { translationService } from "@/services/translationService";
import { fakeServer } from "@/test/fakeServer";

/**
 * The wire contract of every HTTP service method against the backend controllers (PLAN.md §25.1): method, path
 * (ids encoded), query, JSON body, and what the method returns. An id with reserved characters proves encoding.
 */
const ID = "a/b c";
const ENC = "a%2Fb%20c";

interface Row {
  name: string;
  call: () => Promise<unknown>;
  method: string;
  url: string;
  body?: unknown;
  response?: unknown;
  status?: number;
  returns?: unknown;
}

const PAGE = { items: [], nextCursor: null };
const PROFILE = { id: "u1", username: "linh" };

const ROWS: Row[] = [
  // Chat
  {
    name: "conversations",
    call: () => chatService.getConversations(),
    method: "GET",
    url: "/api/conversations",
    response: [],
  },
  {
    name: "one conversation",
    call: () => chatService.getConversation(ID),
    method: "GET",
    url: `/api/conversations/${ENC}`,
    response: { id: ID },
  },
  {
    name: "messages (first page)",
    call: () => chatService.getMessages(ID, null),
    method: "GET",
    url: `/api/conversations/${ENC}/messages`,
    response: PAGE,
  },
  {
    name: "messages (cursor)",
    call: () => chatService.getMessages(ID, "c&2"),
    method: "GET",
    url: `/api/conversations/${ENC}/messages?cursor=c%262`,
    response: PAGE,
  },
  {
    name: "acknowledge",
    call: () => chatService.acknowledge(ID, ["m1"]),
    method: "POST",
    url: `/api/conversations/${ENC}/delivered`,
    body: { messageIds: ["m1"] },
    status: 204,
  },
  {
    name: "mark as read",
    call: () => chatService.markAsRead(ID, "m1"),
    method: "POST",
    url: `/api/conversations/${ENC}/read`,
    body: { messageId: "m1" },
    status: 204,
  },
  {
    name: "react",
    call: () => chatService.react(ID, "👍"),
    method: "POST",
    url: `/api/messages/${ENC}/reactions`,
    body: { emoji: "👍" },
    response: { id: ID },
  },
  {
    name: "forward",
    call: () => chatService.forward(ID, ["c1", "c2"]),
    method: "POST",
    url: `/api/messages/${ENC}/forward`,
    body: { conversationIds: ["c1", "c2"] },
    status: 204,
  },
  {
    name: "mute",
    call: () => chatService.setMuted(ID, true),
    method: "PUT",
    url: `/api/conversations/${ENC}/mute`,
    body: { muted: true },
    response: { id: ID },
  },
  {
    name: "direct",
    call: () => chatService.getOrCreateDirectConversation("u1"),
    method: "POST",
    url: "/api/conversations/direct",
    body: { userId: "u1" },
    response: { id: "c1" },
  },
  {
    name: "group",
    call: () => chatService.createGroup({ title: "Trio", memberIds: ["u1", "u2"] }),
    method: "POST",
    url: "/api/conversations/groups",
    body: { title: "Trio", memberIds: ["u1", "u2"] },
    response: { id: "g1" },
  },
  // Profiles
  {
    name: "me",
    call: () => profileService.getMe(),
    method: "GET",
    url: "/api/me",
    response: { id: "me" },
  },
  {
    name: "accept terms",
    call: () => profileService.acceptTerms("2026-10-04"),
    method: "POST",
    url: "/api/me/terms",
    body: { version: "2026-10-04" },
    response: { id: "me" },
  },
  {
    name: "username availability",
    call: () => profileService.checkUsername("lê ana"),
    method: "GET",
    url: "/api/usernames/l%C3%AA%20ana/availability",
    response: { available: true },
    returns: { available: true },
  },
  {
    name: "preferences",
    call: () => profileService.updatePreferences({ privacy: { whoCanMessage: "nobody" } }),
    method: "PATCH",
    url: "/api/me/preferences",
    body: { privacy: { whoCanMessage: "nobody" } },
    response: { id: "me" },
  },
  {
    name: "profile",
    call: () => profileService.getProfile(ID),
    method: "GET",
    url: `/api/profiles/${ENC}`,
    response: PROFILE,
  },
  {
    name: "suggestions",
    call: () => profileService.getSuggestions(12),
    method: "GET",
    url: "/api/people/suggestions?limit=12",
    response: [],
  },
  {
    name: "search",
    call: () => profileService.searchPeople("lê & ana", 20),
    method: "GET",
    url: "/api/people/search?q=l%C3%AA+%26+ana&limit=20",
    response: [],
  },
  {
    name: "follow",
    call: () => profileService.follow(ID),
    method: "PUT",
    url: `/api/profiles/${ENC}/follow`,
    response: PROFILE,
    returns: PROFILE,
  },
  {
    name: "unfollow",
    call: () => profileService.unfollow(ID),
    method: "DELETE",
    url: `/api/profiles/${ENC}/follow`,
    response: PROFILE,
  },
  {
    name: "follow requests",
    call: () => profileService.getFollowRequests(),
    method: "GET",
    url: "/api/me/follow-requests",
    response: [],
  },
  {
    name: "approve request",
    call: () => profileService.approveFollowRequest(ID),
    method: "POST",
    url: `/api/me/follow-requests/${ENC}/approve`,
    status: 204,
  },
  {
    name: "reject request",
    call: () => profileService.rejectFollowRequest(ID),
    method: "DELETE",
    url: `/api/me/follow-requests/${ENC}`,
    status: 204,
  },
  {
    name: "blocked",
    call: () => profileService.getBlockedUsers(),
    method: "GET",
    url: "/api/me/blocked",
    response: [],
  },
  {
    name: "block",
    call: () => profileService.block(ID),
    method: "PUT",
    url: `/api/profiles/${ENC}/block`,
    status: 204,
    returns: undefined,
  },
  {
    name: "unblock",
    call: () => profileService.unblock(ID),
    method: "DELETE",
    url: `/api/profiles/${ENC}/block`,
    status: 204,
  },
  {
    name: "export",
    call: () => profileService.exportMyData(),
    method: "GET",
    url: "/api/me/export",
    response: { profile: {} },
    returns: { profile: {} },
  },
  {
    name: "delete account",
    call: () => profileService.deleteAccount(),
    method: "DELETE",
    url: "/api/me",
    status: 204,
  },
  // Feed
  {
    name: "feed",
    call: () => feedService.getFeed(null),
    method: "GET",
    url: "/api/feed",
    response: PAGE,
  },
  {
    name: "user posts",
    call: () => feedService.getUserPosts(ID, "x"),
    method: "GET",
    url: `/api/users/${ENC}/posts?cursor=x`,
    response: PAGE,
  },
  {
    name: "post",
    call: () => feedService.getPost(ID),
    method: "GET",
    url: `/api/posts/${ENC}`,
    response: { id: ID },
  },
  {
    name: "like",
    call: () => feedService.like(ID),
    method: "PUT",
    url: `/api/posts/${ENC}/like`,
    response: { id: ID },
  },
  {
    name: "unlike",
    call: () => feedService.unlike(ID),
    method: "DELETE",
    url: `/api/posts/${ENC}/like`,
    response: { id: ID },
  },
  {
    name: "comments",
    call: () => feedService.getComments(ID),
    method: "GET",
    url: `/api/posts/${ENC}/comments`,
    response: [],
  },
  {
    name: "comments after / target",
    call: () => feedService.getComments(ID, "c1", "c9"),
    method: "GET",
    url: `/api/posts/${ENC}/comments?afterId=c1&targetId=c9`,
    response: [],
  },
  {
    name: "add comment",
    call: () => feedService.addComment(ID, "Oi", "k1"),
    method: "POST",
    url: `/api/posts/${ENC}/comments`,
    body: { text: "Oi", clientId: "k1" },
    response: { id: "c1" },
  },
  // Stories
  {
    name: "user stories",
    call: () => storyService.getUserStories(ID),
    method: "GET",
    url: `/api/stories/by-user/${ENC}`,
    response: [],
  },
  {
    name: "story",
    call: () => storyService.getStory(ID),
    method: "GET",
    url: `/api/stories/${ENC}`,
    response: { id: ID },
  },
  {
    name: "tray",
    call: () => storyService.getTray(),
    method: "GET",
    url: "/api/stories/tray",
    response: [],
  },
  {
    name: "view story",
    call: () => storyService.markViewed(ID),
    method: "PUT",
    url: `/api/stories/${ENC}/view`,
    status: 204,
  },
  {
    name: "react to story",
    call: () => storyService.react(ID, "🔥"),
    method: "POST",
    url: `/api/stories/${ENC}/reactions`,
    body: { emoji: "🔥" },
    status: 204,
  },
  {
    name: "reply to story",
    call: () => storyService.reply(ID, "Oi", "k2"),
    method: "POST",
    url: `/api/stories/${ENC}/replies`,
    body: { clientId: "k2", text: "Oi" },
    response: { conversationId: "c1", message: { id: "m1" } },
    returns: { conversationId: "c1", message: { id: "m1" } },
  },
  // Notifications
  {
    name: "notifications",
    call: () => notificationService.list(),
    method: "GET",
    url: "/api/notifications",
    response: [],
  },
  {
    name: "notifications before",
    call: () => notificationService.list("n 1"),
    method: "GET",
    url: "/api/notifications?beforeId=n+1",
    response: [],
  },
  {
    name: "read some",
    call: () => notificationService.markRead(["n1"]),
    method: "POST",
    url: "/api/notifications/read",
    body: { ids: ["n1"] },
    status: 204,
  },
  {
    name: "unread count",
    call: () => notificationService.unreadCount(),
    method: "GET",
    url: "/api/notifications/unread-count",
    response: { count: 7 },
    returns: 7,
  },
  {
    name: "read all",
    call: () => notificationService.markAllRead(),
    method: "POST",
    url: "/api/notifications/read-all",
    status: 204,
  },
  // Discover
  {
    name: "discover",
    call: () => discoverService.getPosts("s:5"),
    method: "GET",
    url: "/api/discover?cursor=s%3A5",
    response: PAGE,
  },
  {
    name: "unhide post",
    call: () => discoverService.unhidePost(ID),
    method: "DELETE",
    url: `/api/discover/hidden/posts/${ENC}`,
    status: 204,
  },
  {
    name: "unhide author",
    call: () => discoverService.unhideAuthor(ID),
    method: "DELETE",
    url: `/api/discover/hidden/authors/${ENC}`,
    status: 204,
  },
  // Translation
  {
    name: "retry translation",
    call: () => translationService.retryMessageTranslation(ID),
    method: "POST",
    url: `/api/messages/${ENC}/translation/retry`,
    response: { status: "translating" },
  },
  {
    name: "insight",
    call: () => translationService.getTranslationInsight(ID, "pt-BR"),
    method: "GET",
    url: `/api/messages/${ENC}/insight?lang=pt-BR`,
    response: {},
  },
  {
    name: "translate a caption",
    call: () => translationService.translateContent({ kind: "post", id: ID }, "en-US"),
    method: "POST",
    url: `/api/translations/post/${ENC}?lang=en-US`,
    response: { status: "pending" },
  },
  // Moderation and admin
  {
    name: "report",
    call: () => moderationService.report({ kind: "post", id: "p1" }, "spam"),
    method: "POST",
    url: "/api/reports",
    body: { targetKind: "post", targetId: "p1", reason: "spam" },
    response: { id: "r1" },
    returns: undefined,
  },
  {
    name: "AI status",
    call: () => adminService.getAiStatus(),
    method: "GET",
    url: "/api/admin/ai",
    response: { providers: [], queue: {} },
  },
  {
    name: "check provider",
    call: () => adminService.checkProvider("open ai"),
    method: "POST",
    url: "/api/admin/ai/open%20ai/check",
    response: { ok: true },
  },
  {
    name: "reports",
    call: () => adminService.listReports("open"),
    method: "GET",
    url: "/api/admin/reports?status=open",
    response: [],
  },
  {
    name: "resolve report",
    call: () => adminService.resolveReport(ID, "reviewed"),
    method: "PATCH",
    url: `/api/admin/reports/${ENC}`,
    body: { status: "reviewed" },
    response: { id: ID },
  },
];

describe("HTTP services: wire contract", () => {
  it.each(ROWS.map((row) => [row.name, row] as const))("%s", async (_name, row) => {
    const path = row.url.split("?")[0] ?? row.url;
    fakeServer.on(row.method, path, { status: row.status ?? 200, body: row.response });

    const result = await row.call();

    const request = fakeServer.last(path, row.method);
    expect(request?.url).toBe(row.url);
    expect(request?.body).toEqual(row.body);
    if (row.method !== "GET") expect(request?.headers["x-xsrf-token"]).toBe("csrf-token");
    else expect(request?.headers["x-xsrf-token"]).toBeUndefined();
    expect(result).toEqual("returns" in row ? row.returns : row.response);
  });

  it("covers every method of every service interface", () => {
    const methods = [
      chatService,
      profileService,
      feedService,
      storyService,
      notificationService,
      discoverService,
      translationService,
      adminService,
      moderationService,
    ].reduce((count, service) => count + Object.keys(service).length, 0);
    // trackEvents, sendMessage, completeOnboarding, updateProfile and createPost/createStory upload media
    // first and have their own tests (outbox.http.test.ts, media.http.test.ts).
    const withOwnTests = 6;
    expect(ROWS.length).toBeGreaterThanOrEqual(methods - withOwnTests);
  });

  it("tracking events can outlive the page (keepalive) only when asked", async () => {
    fakeServer.on("POST", "/api/discover/events", { status: 204 });
    const event = {
      clientId: "e1",
      postId: "p1",
      kind: "impression" as const,
      at: "2026-10-05T00:00:00Z",
    };
    await discoverService.trackEvents([event]);
    await discoverService.trackEvents([event], { keepalive: true });
    const sent = fakeServer.requests.filter((request) => request.url === "/api/discover/events");
    expect(sent.map((request) => request.keepalive)).toEqual([false, true]);
    expect(sent[0]?.body).toEqual({ events: [event] });
  });
});
