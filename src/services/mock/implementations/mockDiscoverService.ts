import { AppError } from "@/lib/errors";
import { isSameLanguage } from "@/lib/languages";
import type { DiscoverService } from "@/services/discoverService";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { toUserProfile } from "../mappers";
import { requireViewerId } from "../session";

const PAGE_SIZE = 6;

export const mockDiscoverService: DiscoverService = {
  getPeople(filters, cursor) {
    return mockRequest(() => {
      const viewerId = requireViewerId();
      const db = mockDb.read();
      const viewer = db.users[viewerId];
      if (!viewer) throw new AppError("unauthenticated", "Your session has expired.");
      const people = Object.values(db.users)
        .filter((user) => user.id !== viewerId && user.onboardingCompletedAt)
        .filter(
          (user) =>
            !viewer.blockedUserIds.includes(user.id) && !user.blockedUserIds.includes(viewerId),
        )
        .filter(
          (user) =>
            !filters.nativeLanguage || isSameLanguage(user.nativeLanguage, filters.nativeLanguage),
        )
        // People learning the viewer's language first: the best matches for a conversation.
        .sort((a, b) => {
          const score = (learning: string[]) =>
            learning.some((l) => isSameLanguage(l, viewer.nativeLanguage)) ? 1 : 0;
          return (
            score(b.learningLanguages) - score(a.learningLanguages) || a.id.localeCompare(b.id)
          );
        });
      const start = cursor ? Number(cursor) : 0;
      const items = people
        .slice(start, start + PAGE_SIZE)
        .map((user) => toUserProfile(user, db, viewerId));
      const next = start + PAGE_SIZE;
      return { items, nextCursor: next < people.length ? String(next) : null };
    });
  },
};
