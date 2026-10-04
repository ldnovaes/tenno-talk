import type { AdminService } from "@/services/adminService";
import type { AiStatus, ProviderState } from "@/types/admin";
import type { Report } from "@/types/moderation";

import { http } from "./httpClient";

const provider = (id: string) => `/api/admin/ai/${encodeURIComponent(id)}`;

export const httpAdminService: AdminService = {
  getAiStatus: () => http<AiStatus>("GET", "/api/admin/ai"),
  checkProvider: (id) =>
    http<{ ok: boolean; provider: ProviderState }>("POST", `${provider(id)}/check`),
  listReports: (status) => http<Report[]>("GET", "/api/admin/reports", { query: { status } }),
  resolveReport: (id, status) =>
    http<Report>("PATCH", `/api/admin/reports/${encodeURIComponent(id)}`, { body: { status } }),
};
