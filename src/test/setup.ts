import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import "@/app/i18n";
import { mockDb } from "@/services/mock/db";
import { resetPresence } from "@/services/mock/presence";
import { resetMockConfig, setMockConfig } from "@/services/mock/latency";
import { useSessionStore } from "@/stores/sessionStore";

import { resetDom } from "./dom";

export { setPrefersDark, setViewportWidth } from "./dom";

// Generous on purpose: a "findBy" returns as soon as the element shows up, but the first test of a
// file loads lazy routes cold, which under a full parallel run (e.g. the deploy) can take > 3s.
configure({ asyncUtilTimeout: 8000 });

/** Deterministic mock backend for tests: no latency, no failures, no auto replies. */
export const TEST_MOCK_CONFIG = {
  minLatencyMs: 0,
  maxLatencyMs: 0,
  failureRate: 0,
  translationFailureRate: 0,
  improvedTranslationRate: 0,
  translationDelayMs: 0,
  improvedTranslationDelayMs: 0,
  autoReply: false,
  autoReplyDelayMs: 0,
};

beforeEach(() => {
  resetDom();
  localStorage.clear();
  sessionStorage.clear();
  mockDb.reset();
  resetPresence();
  useSessionStore.setState({ status: "unknown", userId: null });
  setMockConfig(TEST_MOCK_CONFIG);
});

afterEach(() => {
  cleanup();
  resetMockConfig();
  setMockConfig(TEST_MOCK_CONFIG);
});
