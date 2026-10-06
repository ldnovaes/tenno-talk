import type { AdminService } from "@/services/adminService";
import type { ProviderState } from "@/types/admin";

import { AppError } from "@/lib/errors";

import { mockDb } from "../db";
import { mockRequest } from "../latency";
import { mockReports } from "../mockReports";
import { requireViewerId } from "../session";

/** Like the backend's /api/admin/** (SecurityMatrixIT): only admins, whatever the UI shows. */
function admin<T>(work: () => T): Promise<T> {
  return mockRequest(() => {
    if (mockDb.read().users[requireViewerId()]?.role !== "admin")
      throw new AppError("forbidden", "Only admins can do this.");
    return work();
  });
}

const MODELS: Record<string, string> = { openai: "gpt-4.1-mini", anthropic: "claude-haiku-4-5" };

/** The mock has no real providers: both are healthy and every check succeeds. */
function healthy(provider: string): ProviderState {
  return {
    provider,
    model: MODELS[provider] ?? null,
    state: "ok",
    until: null,
    lastError: null,
    checkedAt: new Date().toISOString(),
  };
}

export const mockAdminService: AdminService = {
  getAiStatus: () =>
    admin(() => ({
      providers: [healthy("openai"), healthy("anthropic")],
      queue: { pending: 0, running: 0, waiting_provider: 0, failed: 0 },
    })),
  checkProvider: (provider) => admin(() => ({ ok: true, provider: healthy(provider) })),
  listReports: (status) => admin(() => mockReports.filter((r) => r.status === status)),
  resolveReport: (id, status) =>
    admin(() => {
      const report = mockReports.find((r) => r.id === id);
      if (!report) throw new AppError("not_found", "Report not found.");
      report.status = status;
      return { ...report };
    }),
};
