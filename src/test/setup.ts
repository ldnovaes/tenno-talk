import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import "@/app/i18n";
import { mockDb } from "@/services/mock/db";
import { resetPresence } from "@/services/mock/presence";
import { resetMockConfig, setMockConfig } from "@/services/mock/latency";
import { useSessionStore } from "@/stores/sessionStore";

// Lazy routes load on first use; give async queries more room than the 1s default.
configure({ asyncUtilTimeout: 3000 });

/** Viewport used by matchMedia in tests. Override with setViewportWidth(). */
let viewportWidth = 375;
let prefersDark = false;

export function setViewportWidth(width: number) {
  viewportWidth = width;
}

export function setPrefersDark(value: boolean) {
  prefersDark = value;
}

function evaluate(query: string): boolean {
  const min = /min-width:\s*(\d+)px/.exec(query);
  if (min?.[1]) return viewportWidth >= Number(min[1]);
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (max?.[1]) return viewportWidth <= Number(max[1]);
  if (query.includes("prefers-color-scheme: dark")) return prefersDark;
  return false;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: evaluate(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
Element.prototype.scrollIntoView = function scrollIntoView() {};
Element.prototype.scrollTo = function scrollTo() {};
// Radix (Select, Slider…) relies on pointer capture APIs missing in jsdom.
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

/** Never intersects: infinite lists don't auto-load in tests (load more is explicit). */
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

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
  viewportWidth = 375;
  prefersDark = false;
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
