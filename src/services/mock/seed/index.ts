import type { MockDatabase } from "../schema";
import { seedConversations } from "./conversations";
import { seedPosts } from "./posts";
import { seedUsers } from "./users";

export function createSeed(now = Date.now()): MockDatabase {
  const users = seedUsers(now);
  const { conversations, messages } = seedConversations(users, now);
  const { posts, comments } = seedPosts(users, now);
  return {
    users,
    follows: [
      { followerId: "usr_lucas", followeeId: "usr_cam", createdAt: new Date(now).toISOString() },
      { followerId: "usr_cam", followeeId: "usr_lucas", createdAt: new Date(now).toISOString() },
      { followerId: "usr_sofia", followeeId: "usr_lucas", createdAt: new Date(now).toISOString() },
      { followerId: "usr_lucas", followeeId: "usr_sofia", createdAt: new Date(now).toISOString() },
      { followerId: "usr_minh", followeeId: "usr_cam", createdAt: new Date(now).toISOString() },
    ],
    conversations,
    messages,
    posts,
    comments,
    stories: {},
    notifications: {},
  };
}
