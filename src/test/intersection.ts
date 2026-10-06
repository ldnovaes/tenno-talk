import { vi } from "vitest";

/**
 * A controllable IntersectionObserver for tests (the default stub never intersects): tests decide when an
 * element scrolls into view. Install per test; vi.unstubAllGlobals() restores the default.
 */
export function controllableIntersection() {
  const observers = new Set<Observer>();

  class Observer implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly scrollMargin = "0px";
    readonly thresholds = [0];
    readonly targets = new Set<Element>();
    constructor(private readonly callback: IntersectionObserverCallback) {
      observers.add(this);
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
      observers.delete(this);
    }
    takeRecords() {
      return [];
    }
    fire(target: Element, ratio: number) {
      const entry = {
        target,
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
        time: performance.now(),
        boundingClientRect: target.getBoundingClientRect(),
        intersectionRect: target.getBoundingClientRect(),
        rootBounds: null,
      } as IntersectionObserverEntry;
      this.callback([entry], this);
    }
  }

  vi.stubGlobal("IntersectionObserver", Observer);
  return {
    /** Every observed element (optionally only those matching `filter`) enters the viewport at `ratio`. */
    showAll(ratio = 1, filter: (element: Element) => boolean = () => true) {
      for (const observer of [...observers])
        for (const target of [...observer.targets])
          if (filter(target)) observer.fire(target, ratio);
    },
    show(element: Element, ratio = 1) {
      for (const observer of [...observers])
        if (observer.targets.has(element)) observer.fire(element, ratio);
    },
    observed() {
      return [...observers].flatMap((observer) => [...observer.targets]);
    },
  };
}
