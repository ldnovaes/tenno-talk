import type { AiStatus, ProviderState } from "@/types/admin";
import type { Report, ReportStatus } from "@/types/moderation";

import { httpAdminService } from "./http/httpAdminService";
import { mockAdminService } from "./mock/implementations/mockAdminService";

/** Admin-only operations; the server enforces the role (PLAN.md §31). */
export interface AdminService {
  getAiStatus(): Promise<AiStatus>;
  checkProvider(provider: string): Promise<{ ok: boolean; provider: ProviderState }>;
  listReports(status: ReportStatus): Promise<Report[]>;
  resolveReport(id: string, status: Exclude<ReportStatus, "open">): Promise<Report>;
}

export const adminService: AdminService = __USE_HTTP__ ? httpAdminService : mockAdminService;
