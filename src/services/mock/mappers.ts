import type { CurrentUser, User, UserProfile } from "@/types/user";

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
  return {
    ...toUser(record),
    bio: record.bio,
    country: record.country,
    nativeLanguage: record.nativeLanguage,
    learningLanguages: record.learningLanguages,
    followersCount: db.follows.filter((f) => f.followeeId === record.id).length,
    followingCount: db.follows.filter((f) => f.followerId === record.id).length,
    postsCount: Object.values(db.posts).filter((p) => p.authorId === record.id).length,
    isFollowing: db.follows.some((f) => f.followerId === viewerId && f.followeeId === record.id),
    isOnline: record.isOnline,
    lastSeenAt: record.lastSeenAt,
  };
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
