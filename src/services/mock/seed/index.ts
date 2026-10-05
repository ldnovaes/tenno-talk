import type { MockDatabase } from "../schema";
import { seedConversations } from "./conversations";
import { seedPosts } from "./posts";
import { seedNotifications, seedStories } from "./stories";
import { seedUsers } from "./users";

export function createSeed(now = Date.now()): MockDatabase {
  const users = seedUsers(now);
  const { conversations, messages } = seedConversations(users, now);
  const { posts, comments } = seedPosts(users, now);
  return {
    users,
    follows: [
      { followerId: "usr_rafael", followeeId: "usr_linh", createdAt: new Date(now).toISOString() },
      { followerId: "usr_linh", followeeId: "usr_rafael", createdAt: new Date(now).toISOString() },
      { followerId: "usr_sofia", followeeId: "usr_rafael", createdAt: new Date(now).toISOString() },
      { followerId: "usr_rafael", followeeId: "usr_sofia", createdAt: new Date(now).toISOString() },
      { followerId: "usr_minh", followeeId: "usr_linh", createdAt: new Date(now).toISOString() },
    ],
    followRequests: [],
    conversations,
    messages,
    posts,
    comments,
    stories: seedStories(users, now),
    notifications: seedNotifications(now),
    discover: { hiddenPosts: [], hiddenAuthors: [], seen: [] },
  };
}
