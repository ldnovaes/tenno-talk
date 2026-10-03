import { readJson, removeKey, writeJson } from "@/lib/storage";

interface Persisted<T> {
  version: number;
  data: T;
}

export interface MockStore<T> {
  read(): T;
  /** Mutates the state in place and persists it. */
  update<R>(mutator: (state: T) => R): R;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * In-memory mock database persisted to localStorage (PLAN.md §16.2).
 * Bumping `version` discards stale data when the seed changes.
 */
export function createMockStore<T>(options: {
  key: string;
  version: number;
  seed: () => T;
  persist?: boolean;
}): MockStore<T> {
  const persist = options.persist ?? true;
  const listeners = new Set<() => void>();

  function load(): T {
    const stored = persist ? readJson<Persisted<T>>(options.key) : null;
    if (stored && stored.version === options.version) return stored.data;
    return options.seed();
  }

  let state = load();

  function save() {
    if (persist) writeJson(options.key, { version: options.version, data: state });
    listeners.forEach((listener) => listener());
  }

  return {
    read: () => state,
    update(mutator) {
      const result = mutator(state);
      save();
      return result;
    },
    reset() {
      if (persist) removeKey(options.key);
      state = options.seed();
      save();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
