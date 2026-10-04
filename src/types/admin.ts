import type { ISODateString } from "./api";

/**
 * AI provider health, as the backend sees it (PLAN.md §28.3). `not_configured` means
 * the server has no API key for the provider; it is never stored.
 */
export type ProviderStateName = "ok" | "invalid_key" | "cooling_down" | "not_configured";

export interface ProviderState {
  provider: string;
  model: string | null;
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
