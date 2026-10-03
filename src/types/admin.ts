import type { ISODateString } from "./api";

/** AI provider health, as the backend sees it (PLAN.md §28.3). */
export type ProviderStateName = "ok" | "needs_reauth" | "reauth_pending" | "cooling_down";

export interface ProviderState {
  provider: string;
  state: ProviderStateName;
  until: ISODateString | null;
  lastError: string | null;
  checkedAt: ISODateString | null;
}

export interface AiStatus {
  providers: ProviderState[];
  /** Translation jobs by status: pending, running, waiting_provider, failed. */
  queue: Record<string, number>;
}

/** Device login started on the server: the admin opens the link and types the code. */
export interface ReauthChallenge {
  provider: string;
  verificationUrl: string | null;
  userCode: string | null;
  output: string[];
}
