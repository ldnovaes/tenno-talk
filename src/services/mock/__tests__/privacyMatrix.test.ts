import { describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockChatService } from "@/services/mock/implementations/mockChatService";
import { mockFeedService } from "@/services/mock/implementations/mockFeedService";
import { mockProfileService } from "@/services/mock/implementations/mockProfileService";
import { mockStoryService } from "@/services/mock/implementations/mockStoryService";
import type { MockDatabase, UserRecord } from "@/services/mock/schema";
import { writeMockSession } from "@/services/mock/session";
import { toAppError } from "@/lib/errors";
import type { Audience } from "@/types/preferences";

/**
 * The privacy matrix of PLAN.md §31.1 against the mock backend: the same cases and oracle as the backend's
 * PrivacyMatrixIT, so that the app behaves the same with mock and real data.
 */

const RELATIONS = [
  "stranger",
  "i_follow",
  "follows_me",
  "mutual",
  "i_requested",
  "owner_requested",
  "i_blocked",
  "blocked_me",
] as const;
type Relation = (typeof RELATIONS)[number];
const AUDIENCES: Audience[] = ["everyone", "followers", "nobody"];

interface Case {
  relation: Relation;
  visibility: "public" | "private";
  message: Audience;
  comment: Audience;
  online: Audience;
}

const oracle = (c: Case) => {
  const blocked = c.relation === "i_blocked" || c.relation === "blocked_me";
  const ownerFollowsViewer = c.relation === "follows_me" || c.relation === "mutual";
  const viewerFollowsOwner = c.relation === "i_follow" || c.relation === "mutual";
  const contentVisible = !blocked && (c.visibility === "public" || viewerFollowsOwner);
  const restriction =
    c.relation === "i_blocked"
      ? "you_blocked"
      : c.relation === "blocked_me" || c.message === "nobody"
        ? "unavailable"
        : c.message === "followers" && !ownerFollowsViewer && c.relation !== "owner_requested"
          ? "followers_only"
          : null;
  return {
    blocked,
    contentVisible,
    commentAllowed: c.comment === "everyone" || (c.comment === "followers" && ownerFollowsViewer),
    presenceVisible:
      !blocked && (c.online === "everyone" || (c.online === "followers" && ownerFollowsViewer)),
    restriction,
    blockStatus:
      c.relation === "i_blocked"
        ? "blocked_by_me"
        : c.relation === "blocked_me"
          ? "blocked_me"
          : "none",
  };
};

const cases: Case[] = RELATIONS.flatMap(
  (relation) =>
    (["public", "private"] as const).flatMap((visibility) =>
      AUDIENCES.flatMap((message) =>
        AUDIENCES.flatMap((comment) =>
          AUDIENCES.map((online) => ({ relation, visibility, message, comment, online })),
        ),
      ),
    ),
  // A pending request to a public profile can't exist: going public approves them all.
).filter((c) => !(c.relation === "i_requested" && c.visibility === "public"));

const OWNER = "usr_owner";
const VIEWER = "usr_viewer";
const THIRD = "usr_third";

function person(db: MockDatabase, id: string): UserRecord {
  const template = db.users["usr_linh"];
  if (!template) throw new Error("seed changed");
  const username = id.replace("usr_", "");
  return {
    ...template,
    id,
    username,
    displayName: username,
    email: `${username}@example.com`,
    bio: "Owner bio",
    blockedUserIds: [],
    isOnline: false,
    lastSeenAt: "2026-10-05T10:00:00.000Z",
    preferences: structuredClone(template.preferences),
  };
}

function arrange(c: Case): { post: string; story: string } {
  let ids = { post: "", story: "" };
  mockDb.update((db) => {
    for (const id of [OWNER, VIEWER, THIRD]) db.users[id] = person(db, id);
    const post = Object.values(db.posts)[0];
    const story = Object.values(db.stories)[0];
    if (!post || !story) throw new Error("seed changed");
    db.posts["post_owner"] = { ...post, id: "post_owner", authorId: OWNER, likedBy: [] };
    db.stories["story_owner"] = {
      ...story,
      id: "story_owner",
      authorId: OWNER,
      viewedBy: [],
      reactions: [],
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    const owner = db.users[OWNER];
    const viewer = db.users[VIEWER];
    if (!owner || !viewer) throw new Error("unreachable");
    owner.preferences.privacy = {
      profileVisibility: c.visibility,
      whoCanMessage: c.message,
      whoCanComment: c.comment,
      whoCanSeeOnline: c.online,
    };
    const follow = (a: string, b: string) =>
      db.follows.push({ followerId: a, followeeId: b, createdAt: new Date().toISOString() });
    const request = (a: string, b: string) =>
      db.followRequests.push({ followerId: a, followeeId: b, createdAt: new Date().toISOString() });
    if (c.relation === "i_follow" || c.relation === "mutual") follow(VIEWER, OWNER);
    if (c.relation === "follows_me" || c.relation === "mutual") follow(OWNER, VIEWER);
    if (c.relation === "i_requested") request(VIEWER, OWNER);
    if (c.relation === "owner_requested") {
      viewer.preferences.privacy.profileVisibility = "private";
      request(OWNER, VIEWER);
    }
    if (c.relation === "i_blocked") viewer.blockedUserIds.push(OWNER);
    if (c.relation === "blocked_me") owner.blockedUserIds.push(VIEWER);
    ids = { post: "post_owner", story: "story_owner" };
  });
  return ids;
}

/** HTTP-like outcome: 200, or the status of the AppError code. */
async function outcome(call: () => Promise<unknown>): Promise<number> {
  try {
    await call();
    return 200;
  } catch (error) {
    const code = toAppError(error).code;
    return code === "not_found"
      ? 404
      : code === "forbidden"
        ? 403
        : code === "validation"
          ? 400
          : 500;
  }
}

describe("privacy matrix (mock backend)", () => {
  it.each(cases)("%o", async (c) => {
    const { post, story } = arrange(c);
    const expected = oracle(c);
    writeMockSession(VIEWER);

    const profile = await mockProfileService.getProfile("owner");
    expect(profile.blockStatus).toBe(expected.blockStatus);
    expect(profile.lastSeenAt === null).toBe(!expected.presenceVisible);
    expect(profile.bio === null).toBe(c.relation === "blocked_me");

    const found = (await mockProfileService.searchPeople("owner", 20)).find((p) => p.id === OWNER);
    expect(found !== undefined).toBe(!expected.blocked);
    if (found) expect(found.lastSeenAt === null).toBe(!expected.presenceVisible);

    expect((await mockFeedService.getUserPosts(OWNER, null)).items.length).toBe(
      expected.contentVisible ? 1 : 0,
    );
    expect((await mockStoryService.getUserStories(OWNER)).length).toBe(
      expected.contentVisible ? 1 : 0,
    );
    expect(await outcome(() => mockFeedService.like(post))).toBe(
      expected.contentVisible ? 200 : 404,
    );
    expect(await outcome(() => mockFeedService.addComment(post, "Nice"))).toBe(
      !expected.contentVisible ? 404 : expected.commentAllowed ? 200 : 403,
    );

    const start = await outcome(() => mockChatService.getOrCreateDirectConversation(OWNER));
    expect(start).toBe(expected.restriction === null ? 200 : 403);
    if (start !== 200)
      mockDb.update((db) => {
        const now = new Date().toISOString();
        db.conversations["conv_matrix"] = {
          id: "conv_matrix",
          kind: "direct",
          title: null,
          avatarUrl: null,
          createdBy: OWNER,
          memberIds: [OWNER, VIEWER],
          lastReadMessageId: {},
          lastDeliveredMessageId: {},
          mutedUntil: {},
          createdAt: now,
          updatedAt: now,
        };
      });
    const conversation = (await mockChatService.getConversations()).find(
      (item) => item.kind === "direct" && item.members.some((m) => m.user.id === OWNER),
    );
    if (!conversation) throw new Error("conversation missing");
    expect(conversation.sendRestriction).toBe(expected.restriction);
    const ownerMember = conversation.members.find((m) => m.user.id === OWNER);
    expect(ownerMember?.lastSeenAt === null).toBe(!expected.presenceVisible);
    expect(
      await outcome(() =>
        mockChatService.sendMessage({
          conversationId: conversation.id,
          clientId: "matrix",
          text: "Oi",
          media: [],
          replyToId: null,
        }),
      ),
    ).toBe(expected.restriction === null ? 200 : 403);
    expect(await outcome(() => mockStoryService.reply(story, "Wow"))).toBe(
      !expected.contentVisible ? 404 : expected.restriction === null ? 200 : 403,
    );
    expect(
      await outcome(() =>
        mockChatService.createGroup({ title: "Trio", memberIds: [OWNER, THIRD] }),
      ),
    ).toBe(expected.restriction === null ? 200 : 400);
  });
});
