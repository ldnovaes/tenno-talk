/** jsdom gaps shared by both Vitest projects (setup.ts and setupHttp.ts). */

/** Viewport used by matchMedia in tests. Override with setViewportWidth(). */
let viewportWidth = 375;
let prefersDark = false;

export function setViewportWidth(width: number) {
  viewportWidth = width;
}

export function setPrefersDark(value: boolean) {
  prefersDark = value;
}

export function resetDom() {
  viewportWidth = 375;
  prefersDark = false;
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

/** vaul (drawers) reads the computed transform, which jsdom's getComputedStyle leaves undefined. */
const computedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element: Element, pseudo?: string | null) => {
  const style = computedStyle(element, pseudo);
  if (style.transform) return style;
  return new Proxy(style, {
    get: (target, key) => {
      if (key === "transform") return "none";
      const value: unknown = Reflect.get(target, key);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
};
