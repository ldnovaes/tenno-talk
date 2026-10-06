import { AppError } from "@/lib/errors";
import type { ModerationService } from "@/services/moderationService";

import type { ReportTarget } from "@/types/moderation";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { mockReports } from "../mockReports";
import { canSeePosts } from "../postProjections";
import type { MockDatabase } from "../schema";
import { requireViewerId } from "../session";

/** Who owns the target, if the viewer can see it: only what you can see can be reported (ReportService). */
function ownerOfVisible(db: MockDatabase, target: ReportTarget, viewerId: string): string | null {
  switch (target.kind) {
    case "user":
      return db.users[target.id] ? target.id : null;
    case "message": {
      const message = db.messages[target.id];
      const member =
        message && db.conversations[message.conversationId]?.memberIds.includes(viewerId);
      return member ? message.senderId : null;
    }
    case "post": {
      const post = db.posts[target.id];
      return post && canSeePosts(db, post.authorId, viewerId) ? post.authorId : null;
    }
    case "comment": {
      const comment = db.comments[target.id];
      const post = comment && db.posts[comment.postId];
      return comment && post && canSeePosts(db, post.authorId, viewerId) ? comment.authorId : null;
    }
    case "story": {
      const story = db.stories[target.id];
      return story && canSeePosts(db, story.authorId, viewerId) ? story.authorId : null;
    }
  }
}

export const mockModerationService: ModerationService = {
  report: (target, reason) =>
    mockRequest(() => {
      const viewerId = requireViewerId();
      const owner = ownerOfVisible(mockDb.read(), target, viewerId);
      if (owner === null) throw new AppError("not_found", "Not found.");
      if (owner === viewerId) throw new AppError("validation", "You can't report yourself.");
      const duplicate = mockReports.some(
        (r) =>
          r.reporterId === viewerId &&
          r.targetKind === target.kind &&
          r.targetId === target.id &&
          r.status === "open",
      );
      if (duplicate) return;
      mockReports.unshift({
        id: `rep_${crypto.randomUUID().slice(0, 8)}`,
        targetKind: target.kind,
        targetId: target.id,
        reason,
        status: "open",
        createdAt: new Date().toISOString(),
        reporterId: viewerId,
        reporterUsername: mockDb.read().users[viewerId]?.username ?? "",
      });
    }),
};
