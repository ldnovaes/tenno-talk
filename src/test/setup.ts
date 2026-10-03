import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import "@/app/i18n";
import { resetMockConfig, setMockConfig } from "@/services/mock/latency";

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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

beforeEach(() => {
  viewportWidth = 375;
  prefersDark = false;
  localStorage.clear();
  sessionStorage.clear();
  setMockConfig({
    minLatencyMs: 0,
    maxLatencyMs: 0,
    failureRate: 0,
    translationFailureRate: 0,
    improvedTranslationRate: 0,
  });
});

afterEach(() => {
  cleanup();
  resetMockConfig();
  setMockConfig({
    minLatencyMs: 0,
    maxLatencyMs: 0,
    failureRate: 0,
    translationFailureRate: 0,
    improvedTranslationRate: 0,
  });
});
