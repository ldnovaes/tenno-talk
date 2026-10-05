import { AppError } from "@/lib/errors";
import { mergePreferences } from "@/lib/preferences";
import { normalizeUsername, validateUsername } from "@/lib/username";
import type {
  CompleteOnboardingInput,
  PreferencesPatch,
  ProfileService,
  UpdateProfileInput,
} from "@/services/profileService";
import type { LanguageCode } from "@/types/language";

import { mockDb } from "../db";
import { publish, type ServerEvent } from "../events";
import { mockRequest } from "../latency";
import { addNotification, retractNotifications } from "../notificationRecords";
import { blockedEitherWay } from "../privacy";
import { toCurrentUser, toUserProfile } from "../mappers";
import type { MockDatabase, UserRecord } from "../schema";
import { clearMockSession, requireViewerId } from "../session";

function viewerRecord(db: MockDatabase): UserRecord {
  const viewer = db.users[requireViewerId()];
  if (!viewer) throw new AppError("unauthenticated", "Your session has expired. Sign in again.");
  return viewer;
}

function findByUsername(db: MockDatabase, username: string): UserRecord | undefined {
  const normalized = normalizeUsername(username);
  return Object.values(db.users).find((user) => user.username === normalized);
}

function assertUsernameAvailable(db: MockDatabase, username: string, ownerId: string) {
  const problem = validateUsername(username);
  if (problem) {
    throw new AppError("validation", "This username is not valid.", {
      fieldErrors: { username: problem },
    });
  }
  const existing = findByUsername(db, username);
  if (existing && existing.id !== ownerId) {
    throw new AppError("conflict", "This username is already taken.", {
      fieldErrors: { username: "taken" },
    });
  }
}

function findUser(db: MockDatabase, userId: string): UserRecord {
  const user = db.users[userId];
  if (!user) throw new AppError("not_found", "User not found.");
  return user;
}

/** A new receiving language applies only to messages sent from now on (PLAN.md §21). */
function recordReceivingChange(user: UserRecord, language: LanguageCode): void {
  if (user.preferences.translation.receivingLanguage === language) return;
  user.receivingLanguageHistory.push({ language, since: new Date().toISOString() });
}

/** Runs a write, then announces the notifications it created or retracted (like the server). */
async function writeAndAnnounce<T>(
  write: (db: MockDatabase, announce: (event: ServerEvent) => void) => T,
): Promise<T> {
  const events: ServerEvent[] = [];
  const result = await mockRequest(() => mockDb.update((db) => write(db, (e) => events.push(e))));
  events.forEach(publish);
  return result;
}

function announceCreated(
  announce: (event: ServerEvent) => void,
  notificationId: string | null,
  recipientId: string,
) {
  if (notificationId) announce({ kind: "notification.created", notificationId, recipientId });
}

function retractRequest(
  db: MockDatabase,
  announce: (event: ServerEvent) => void,
  ownerId: string,
  requesterId?: string,
) {
  if (retractNotifications(db, ownerId, "follow_request", requesterId))
    announce({ kind: "notifications.read", recipientId: ownerId });
}

export const mockProfileService: ProfileService = {
  getMe() {
    return mockRequest(() => {
      const db = mockDb.read();
      return toCurrentUser(viewerRecord(db), db);
    });
  },

  acceptTerms(version) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        viewer.termsAcceptedVersion = version;
        return toCurrentUser(viewer, db);
      }),
    );
  },

  checkUsername(username) {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewerId = requireViewerId();
      if (validateUsername(username)) return { available: false };
      const existing = findByUsername(db, username);
      return { available: !existing || existing.id === viewerId };
    });
  },

  completeOnboarding(input: CompleteOnboardingInput) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        if (!viewer.termsAcceptedVersion) {
          throw new AppError("validation", "Accept the Terms of Use to continue.");
        }
        assertUsernameAvailable(db, input.username, viewer.id);
        viewer.nativeLanguage = input.nativeLanguage;
        recordReceivingChange(viewer, input.receivingLanguage);
        viewer.preferences.translation.receivingLanguage = input.receivingLanguage;
        viewer.displayName = input.displayName.trim();
        viewer.username = normalizeUsername(input.username);
        viewer.bio = input.bio?.trim() || null;
        viewer.country = input.country;
        viewer.avatarUrl = input.avatarUrl;
        viewer.onboardingCompletedAt = new Date().toISOString();
        return toCurrentUser(viewer, db);
      }),
    );
  },

  updateProfile(input: UpdateProfileInput) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        assertUsernameAvailable(db, input.username, viewer.id);
        viewer.displayName = input.displayName.trim();
        viewer.username = normalizeUsername(input.username);
        viewer.bio = input.bio?.trim() || null;
        viewer.country = input.country;
        viewer.avatarUrl = input.avatarUrl;
        viewer.nativeLanguage = input.nativeLanguage;
        viewer.learningLanguages = input.learningLanguages;
        return toCurrentUser(viewer, db);
      }),
    );
  },

  updatePreferences(patch: PreferencesPatch) {
    return writeAndAnnounce((db, announce) => {
      const viewer = viewerRecord(db);
      const current = viewer.preferences;
      if (patch.translation?.receivingLanguage) {
        recordReceivingChange(viewer, patch.translation.receivingLanguage);
      }
      viewer.preferences = mergePreferences(current, patch);
      if (
        current.privacy.profileVisibility === "private" &&
        viewer.preferences.privacy.profileVisibility === "public"
      ) {
        for (const request of db.followRequests.filter((item) => item.followeeId === viewer.id)) {
          if (!blockedEitherWay(db, request.followerId, viewer.id)) db.follows.push({ ...request });
        }
        db.followRequests = db.followRequests.filter((item) => item.followeeId !== viewer.id);
        retractRequest(db, announce, viewer.id);
      }
      return toCurrentUser(viewer, db);
    });
  },

  getProfile(username) {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewerId = requireViewerId();
      const user = findByUsername(db, username);
      // A block shows a notice or a minimal profile instead of hiding it (PLAN.md §31.1).
      if (!user || !user.onboardingCompletedAt) throw new AppError("not_found", "User not found.");
      return toUserProfile(user, db, viewerId);
    });
  },

  getSuggestions(limit) {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewer = viewerRecord(db);
      return Object.values(db.users)
        .filter((user) => user.id !== viewer.id && user.onboardingCompletedAt)
        .filter((user) => !blockedEitherWay(db, viewer.id, user.id))
        .sort((a, b) => Number(b.isOnline) - Number(a.isOnline))
        .slice(0, limit)
        .map((user) => toUserProfile(user, db, viewer.id));
    });
  },

  searchPeople(query, limit) {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewer = viewerRecord(db);
      const normalized = query.trim().toLowerCase().replace(/^@/, "");
      return Object.values(db.users)
        .filter((user) => user.id !== viewer.id && user.onboardingCompletedAt)
        .filter((user) => !blockedEitherWay(db, viewer.id, user.id))
        .filter(
          (user) =>
            !normalized ||
            user.displayName.toLowerCase().includes(normalized) ||
            user.username.includes(normalized),
        )
        .slice(0, limit)
        .map((user) => toUserProfile(user, db, viewer.id));
    });
  },

  follow(userId) {
    return writeAndAnnounce((db, announce) => {
      const viewer = viewerRecord(db);
      const target = findUser(db, userId);
      if (target.id === viewer.id) throw new AppError("validation", "You can't follow yourself.");
      if (blockedEitherWay(db, viewer.id, target.id))
        throw new AppError("not_found", "User not found.");
      const exists = db.follows.some((f) => f.followerId === viewer.id && f.followeeId === userId);
      if (!exists) {
        const entry = {
          followerId: viewer.id,
          followeeId: userId,
          createdAt: new Date().toISOString(),
        };
        if (target.preferences.privacy.profileVisibility === "private") {
          if (
            !db.followRequests.some(
              (item) => item.followerId === viewer.id && item.followeeId === userId,
            )
          ) {
            db.followRequests.push(entry);
            const id = addNotification(db, userId, viewer.id, "follow_request");
            announceCreated(announce, id, userId);
          }
        } else {
          db.follows.push(entry);
          announceCreated(announce, addNotification(db, userId, viewer.id, "follow"), userId);
        }
      }
      return toUserProfile(target, db, viewer.id);
    });
  },

  unfollow(userId) {
    return writeAndAnnounce((db, announce) => {
      const viewer = viewerRecord(db);
      const target = findUser(db, userId);
      db.follows = db.follows.filter(
        (f) => !(f.followerId === viewer.id && f.followeeId === userId),
      );
      db.followRequests = db.followRequests.filter(
        (r) => !(r.followerId === viewer.id && r.followeeId === userId),
      );
      retractRequest(db, announce, userId, viewer.id);
      return toUserProfile(target, db, viewer.id);
    });
  },

  getFollowRequests() {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewerId = requireViewerId();
      return db.followRequests
        .filter((request) => request.followeeId === viewerId)
        .map((request) => db.users[request.followerId])
        .filter((user): user is UserRecord => !!user && !blockedEitherWay(db, viewerId, user.id))
        .map((user) => toUserProfile(user, db, viewerId));
    });
  },

  approveFollowRequest(userId) {
    return writeAndAnnounce((db, announce) => {
      const viewerId = requireViewerId();
      const request = db.followRequests.find(
        (item) => item.followerId === userId && item.followeeId === viewerId,
      );
      if (!request || blockedEitherWay(db, viewerId, userId))
        throw new AppError("not_found", "Follow request not found.");
      db.followRequests = db.followRequests.filter((item) => item !== request);
      if (!db.follows.some((item) => item.followerId === userId && item.followeeId === viewerId))
        db.follows.push({ ...request });
      retractRequest(db, announce, viewerId, userId);
      const id = addNotification(db, userId, viewerId, "follow_accepted");
      announceCreated(announce, id, userId);
    });
  },

  rejectFollowRequest(userId) {
    return writeAndAnnounce((db, announce) => {
      const viewerId = requireViewerId();
      const exists = db.followRequests.some(
        (item) => item.followerId === userId && item.followeeId === viewerId,
      );
      if (!exists) throw new AppError("not_found", "Follow request not found.");
      db.followRequests = db.followRequests.filter(
        (item) => !(item.followerId === userId && item.followeeId === viewerId),
      );
      retractRequest(db, announce, viewerId, userId);
    });
  },

  getBlockedUsers() {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewer = viewerRecord(db);
      return viewer.blockedUserIds
        .map((id) => db.users[id])
        .filter((user): user is UserRecord => user !== undefined)
        .map((user) => toUserProfile(user, db, viewer.id));
    });
  },

  block(userId) {
    return writeAndAnnounce((db, announce) => {
      const viewer = viewerRecord(db);
      findUser(db, userId);
      if (userId === viewer.id) throw new AppError("validation", "You can't block yourself.");
      if (!viewer.blockedUserIds.includes(userId)) viewer.blockedUserIds.push(userId);
      // Blocking also removes follows in both directions.
      db.follows = db.follows.filter(
        (f) =>
          !(
            (f.followerId === viewer.id && f.followeeId === userId) ||
            (f.followerId === userId && f.followeeId === viewer.id)
          ),
      );
      db.followRequests = db.followRequests.filter(
        (r) =>
          !(
            (r.followerId === viewer.id && r.followeeId === userId) ||
            (r.followerId === userId && r.followeeId === viewer.id)
          ),
      );
      retractRequest(db, announce, viewer.id, userId);
      retractRequest(db, announce, userId, viewer.id);
    });
  },

  exportMyData() {
    // Same sections as the server export, from the mock database (never the password).
    return mockRequest(() => {
      const db = mockDb.read();
      const viewerId = requireViewerId();
      const { password: _password, ...account } = db.users[viewerId] ?? {};
      const username = (id: string) => db.users[id]?.username ?? "";
      return {
        format: "tenno-talk-export/1",
        account,
        following: db.follows
          .filter((f) => f.followerId === viewerId)
          .map((f) => username(f.followeeId)),
        followers: db.follows
          .filter((f) => f.followeeId === viewerId)
          .map((f) => username(f.followerId)),
        messagesSent: Object.values(db.messages).filter((m) => m.senderId === viewerId),
        posts: Object.values(db.posts).filter((p) => p.authorId === viewerId),
        comments: Object.values(db.comments).filter((c) => c.authorId === viewerId),
        stories: Object.values(db.stories).filter((st) => st.authorId === viewerId),
      };
    });
  },

  deleteAccount() {
    return mockRequest(() => {
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        delete db.users[viewer.id];
        db.follows = db.follows.filter(
          (f) => f.followerId !== viewer.id && f.followeeId !== viewer.id,
        );
        for (const conversation of Object.values(db.conversations)) {
          if (conversation.memberIds.includes(viewer.id)) delete db.conversations[conversation.id];
        }
        for (const message of Object.values(db.messages)) {
          if (!db.conversations[message.conversationId]) delete db.messages[message.id];
        }
        for (const post of Object.values(db.posts))
          if (post.authorId === viewer.id) delete db.posts[post.id];
        for (const story of Object.values(db.stories))
          if (story.authorId === viewer.id) delete db.stories[story.id];
      });
      clearMockSession();
    });
  },

  unblock(userId) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        viewer.blockedUserIds = viewer.blockedUserIds.filter((id) => id !== userId);
      }),
    );
  },
};
