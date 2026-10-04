import type { ReportReason, ReportTarget } from "@/types/moderation";

import { httpModerationService } from "./http/httpModerationService";
import { mockModerationService } from "./mock/implementations/mockModerationService";

export interface ModerationService {
  /** The server checks that the reporter can see the target. */
  report(target: ReportTarget, reason: ReportReason): Promise<void>;
}

export const moderationService: ModerationService = __USE_HTTP__
  ? httpModerationService
  : mockModerationService;
