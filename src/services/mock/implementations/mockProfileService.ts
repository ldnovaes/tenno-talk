import { AppError } from "@/lib/errors";
import { normalizeUsername, validateUsername } from "@/lib/username";
import type {
  CompleteOnboardingInput,
  PreferencesPatch,
  ProfileService,
  UpdateProfileInput,
} from "@/services/profileService";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
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
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        const current = viewer.preferences;
        viewer.preferences = {
          interfaceLanguage: patch.interfaceLanguage ?? current.interfaceLanguage,
          translation: { ...current.translation, ...patch.translation },
          privacy: { ...current.privacy, ...patch.privacy },
          notifications: { ...current.notifications, ...patch.notifications },
        };
        return toCurrentUser(viewer, db);
      }),
    );
  },

  getProfile(username) {
    return mockRequest(() => {
      const db = mockDb.read();
      const viewerId = requireViewerId();
      const user = findByUsername(db, username);
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
        .filter((user) => !viewer.blockedUserIds.includes(user.id))
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
        .filter((user) => !viewer.blockedUserIds.includes(user.id))
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
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        const target = findUser(db, userId);
        if (target.id === viewer.id) throw new AppError("validation", "You can't follow yourself.");
        const exists = db.follows.some(
          (f) => f.followerId === viewer.id && f.followeeId === userId,
        );
        if (!exists) {
          db.follows.push({
            followerId: viewer.id,
            followeeId: userId,
            createdAt: new Date().toISOString(),
          });
        }
        return toUserProfile(target, db, viewer.id);
      }),
    );
  },

  unfollow(userId) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const viewer = viewerRecord(db);
        const target = findUser(db, userId);
        db.follows = db.follows.filter(
          (f) => !(f.followerId === viewer.id && f.followeeId === userId),
        );
        return toUserProfile(target, db, viewer.id);
      }),
    );
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
    return mockRequest(() =>
      mockDb.update((db) => {
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
      }),
    );
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
