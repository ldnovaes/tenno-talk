import { AppError } from "@/lib/errors";
import type { ModerationService } from "@/services/moderationService";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { mockReports } from "../mockReports";
import { requireViewerId } from "../session";

export const mockModerationService: ModerationService = {
  report: (target, reason) =>
    mockRequest(() => {
      const viewerId = requireViewerId();
      if (target.kind === "user" && target.id === viewerId) {
        throw new AppError("validation", "You can't report yourself.");
      }
      const duplicate = mockReports.some(
        (r) => r.reporterId === viewerId && r.targetId === target.id && r.status === "open",
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
