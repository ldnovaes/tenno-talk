import type { AdminService } from "@/services/adminService";
import type { AiStatus, ProviderState, ReauthChallenge } from "@/types/admin";

import { http } from "./httpClient";

const provider = (id: string) => `/api/admin/ai/${encodeURIComponent(id)}`;

export const httpAdminService: AdminService = {
  getAiStatus: () => http<AiStatus>("GET", "/api/admin/ai"),
  checkProvider: (id) =>
    http<{ ok: boolean; provider: ProviderState }>("POST", `${provider(id)}/check`),
  startReauth: (id) => http<ReauthChallenge>("POST", `${provider(id)}/reauth`),
};
