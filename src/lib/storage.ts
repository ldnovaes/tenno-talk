/** localStorage/sessionStorage wrappers that never throw (private mode, quota, SSR-less tests). */
type StorageKind = "local" | "session";

function getStorage(kind: StorageKind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, kind: StorageKind = "local"): T | null {
  const raw = getStorage(kind)?.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, kind: StorageKind = "local"): void {
  try {
    getStorage(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage unavailable: persistence is best-effort.
  }
}

export function removeKey(key: string, kind: StorageKind = "local"): void {
  getStorage(kind)?.removeItem(key);
}
