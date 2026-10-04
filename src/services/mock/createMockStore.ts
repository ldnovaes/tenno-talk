import { readJson, removeKey, writeJson } from "@/lib/storage";

interface Persisted<T> {
  version: number;
  data: T;
}

export interface MockStore<T> {
  read(): T;
  /** Mutates the state in place and persists it (read-modify-write across tabs). */
  update<R>(mutator: (state: T) => R): R;
  /** Re-reads the persisted state (another tab changed it). */
  reload(): void;
  /** Persisted revision as this tab currently sees it (grows with every write). */
  revision(): number;
  /** Storage key of the revision (its "storage" events tell when this tab caught up). */
  readonly revisionKey: string;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * In-memory mock database persisted to localStorage (PLAN.md §16.2).
 * Bumping `version` discards stale data when the seed changes.
 */
const MAX_RETRIES = 5;

export function createMockStore<T>(options: {
  key: string;
  version: number;
  seed: () => T;
  persist?: boolean;
}): MockStore<T> {
  const persist = options.persist ?? true;
  const listeners = new Set<() => void>();
  const revisionKey = `${options.key}.rev`;

  function readRevision(): number {
    return Number(localStorage.getItem(revisionKey) ?? "0");
  }

  function writeRevision(revision: number) {
    localStorage.setItem(revisionKey, String(revision));
  }

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
      if (!persist) {
        const result = mutator(state);
        save();
        return result;
      }
      // Two tabs are two "clients" of one database: optimistic concurrency on a small revision key.
      // Parsing/serializing the whole database takes milliseconds, enough for another tab to write in
      // between; re-applying the change on fresh data keeps that write instead of erasing it.
      // Mutators are pure state changes (side effects run after update returns), so a retry is safe.
      for (let attempt = 0; ; attempt++) {
        const revision = readRevision();
        state = load();
        const before = JSON.stringify(state);
        const result = mutator(state);
        // Reads that change nothing never write: a tab with a stale view must not overwrite others.
        if (JSON.stringify(state) === before) return result;
        if (readRevision() !== revision && attempt < MAX_RETRIES) continue;
        // Data first, then the revision: a tab that sees the new revision can read the new data.
        save();
        writeRevision(revision + 1);
        return result;
      }
    },
    reload() {
      state = load();
      listeners.forEach((listener) => listener());
    },
    revision: readRevision,
    revisionKey,
    reset() {
      if (persist) {
        removeKey(options.key);
        removeKey(revisionKey);
      }
      state = options.seed();
      save();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
