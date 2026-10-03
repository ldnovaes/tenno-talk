import type { AdminService } from "@/services/adminService";
import type { ProviderState } from "@/types/admin";

import { mockRequest } from "../latency";

/** The mock has no real providers: both are healthy and a login "completes" immediately. */
function healthy(provider: string): ProviderState {
  return {
    provider,
    state: "ok",
    until: null,
    lastError: null,
    checkedAt: new Date().toISOString(),
  };
}

export const mockAdminService: AdminService = {
  getAiStatus: () =>
    mockRequest(() => ({
      providers: [healthy("codex"), healthy("claude")],
      queue: { pending: 0, running: 0, waiting_provider: 0, failed: 0 },
    })),
  checkProvider: (provider) => mockRequest(() => ({ ok: true, provider: healthy(provider) })),
  startReauth: (provider) =>
    mockRequest(() => ({
      provider,
      verificationUrl: "https://example.com/device",
      userCode: "DEMO-0000",
      output: [],
    })),
};
