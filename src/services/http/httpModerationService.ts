import type { ModerationService } from "@/services/moderationService";

import { http } from "./httpClient";

export const httpModerationService: ModerationService = {
  async report(target, reason) {
    await http("POST", "/api/reports", {
      body: { targetKind: target.kind, targetId: target.id, reason },
    });
  },
};
