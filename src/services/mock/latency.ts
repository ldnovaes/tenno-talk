import { AppError, type AppErrorCode } from "@/lib/errors";
import { readJson, writeJson } from "@/lib/storage";

/** Knobs to make mocks feel real (PLAN.md §16.3). Overridable from devtools/tests. */
export interface MockConfig {
  minLatencyMs: number;
  maxLatencyMs: number;
  /** Probability [0..1] that a regular call fails with a network error. */
  failureRate: number;
  /** Probability [0..1] that a translation fails (exercises "Retry translation"). */
  translationFailureRate: number;
  /** Probability [0..1] that a translation gets an improved v2 later. */
  improvedTranslationRate: number;
}

const CONFIG_KEY = "tenno.mock-config";

const DEFAULTS: MockConfig = {
  minLatencyMs: 150,
  maxLatencyMs: 600,
  failureRate: 0,
  translationFailureRate: 0.1,
  improvedTranslationRate: 0.2,
};

let config: MockConfig = { ...DEFAULTS, ...(readJson<Partial<MockConfig>>(CONFIG_KEY) ?? {}) };

export function getMockConfig(): MockConfig {
  return config;
}

export function setMockConfig(patch: Partial<MockConfig>, persist = false): void {
  config = { ...config, ...patch };
  if (persist) writeJson(CONFIG_KEY, config);
}

export function resetMockConfig(): void {
  config = { ...DEFAULTS };
}

export function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomLatency(): number {
  const { minLatencyMs, maxLatencyMs } = config;
  return minLatencyMs + Math.random() * Math.max(0, maxLatencyMs - minLatencyMs);
}

export function chance(probability: number): boolean {
  return probability > 0 && Math.random() < probability;
}

/**
 * Wraps a mock operation: waits a realistic latency, may fail, and returns a deep
 * copy so callers never mutate the mock database by accident.
 */
export async function mockRequest<T>(
  operation: () => T,
  options: { failureCode?: AppErrorCode } = {},
): Promise<T> {
  await sleep(randomLatency());
  if (chance(config.failureRate)) {
    throw new AppError(options.failureCode ?? "network", "Connection problem. Please try again.");
  }
  return structuredClone(operation());
}
