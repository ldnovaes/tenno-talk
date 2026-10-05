import type { CurrentUser, User, UserProfile } from "@/types/user";

import { blockStatus, presenceVisible } from "./privacy";
import type { MockDatabase, UserRecord } from "./schema";

export function toUser(record: UserRecord): User {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    avatarUrl: record.avatarUrl,
  };
}

export function toUserProfile(record: UserRecord, db: MockDatabase, viewerId: string): UserProfile {
  const showPresence = presenceVisible(db, viewerId, record.id);
  return redactBlocked({
    ...toUser(record),
    bio: record.bio,
    country: record.country,
    nativeLanguage: record.nativeLanguage,
    learningLanguages: record.learningLanguages,
    followersCount: db.follows.filter((f) => f.followeeId === record.id).length,
    followingCount: db.follows.filter((f) => f.followerId === record.id).length,
    postsCount: Object.values(db.posts).filter((p) => p.authorId === record.id).length,
    isFollowing: db.follows.some((f) => f.followerId === viewerId && f.followeeId === record.id),
    isPrivate: record.preferences.privacy.profileVisibility === "private",
    followRequestPending: db.followRequests.some(
      (r) => r.followerId === viewerId && r.followeeId === record.id,
    ),
    isOnline: showPresence && record.isOnline,
    lastSeenAt: showPresence ? record.lastSeenAt : null,
    blockStatus: blockStatus(db, viewerId, record.id),
  });
}

/** What a block leaves of a profile (PLAN.md §31.1), like ProfileQueries.redact in the backend. */
function redactBlocked(profile: UserProfile): UserProfile {
  if (profile.blockStatus === "blocked_by_me")
    return { ...profile, isFollowing: false, followRequestPending: false };
  if (profile.blockStatus === "blocked_me")
    return {
      ...profile,
      bio: null,
      learningLanguages: [],
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      isFollowing: false,
      isPrivate: false,
      followRequestPending: false,
    };
  return profile;
}

export function toCurrentUser(record: UserRecord, db: MockDatabase): CurrentUser {
  return {
    ...toUserProfile(record, db, record.id),
    email: record.email,
    role: record.role,
    connectedProviders: record.providers,
    termsAcceptedVersion: record.termsAcceptedVersion,
    onboardingCompletedAt: record.onboardingCompletedAt,
    preferences: record.preferences,
  };
}
