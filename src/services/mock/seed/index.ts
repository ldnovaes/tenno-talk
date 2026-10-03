import type { MockDatabase } from "../schema";
import { seedUsers } from "./users";

export function createSeed(now = Date.now()): MockDatabase {
  return {
    users: seedUsers(now),
    follows: [
      { followerId: "usr_lucas", followeeId: "usr_cam", createdAt: new Date(now).toISOString() },
      { followerId: "usr_cam", followeeId: "usr_lucas", createdAt: new Date(now).toISOString() },
      { followerId: "usr_sofia", followeeId: "usr_lucas", createdAt: new Date(now).toISOString() },
      { followerId: "usr_lucas", followeeId: "usr_sofia", createdAt: new Date(now).toISOString() },
      { followerId: "usr_minh", followeeId: "usr_cam", createdAt: new Date(now).toISOString() },
    ],
    conversations: {},
    messages: {},
    posts: {},
    comments: {},
    stories: {},
    notifications: {},
  };
}
