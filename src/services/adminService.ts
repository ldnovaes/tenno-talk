import { env } from "@/lib/env";
import type { AiStatus, ProviderState, ReauthChallenge } from "@/types/admin";

import { httpAdminService } from "./http/httpAdminService";
import { mockAdminService } from "./mock/implementations/mockAdminService";

/** Admin-only operations; the server enforces the role (PLAN.md §31). */
export interface AdminService {
  getAiStatus(): Promise<AiStatus>;
  checkProvider(provider: string): Promise<{ ok: boolean; provider: ProviderState }>;
  startReauth(provider: string): Promise<ReauthChallenge>;
}

export const adminService: AdminService =
  env.dataSource === "http" ? httpAdminService : mockAdminService;
