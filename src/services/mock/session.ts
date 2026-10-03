import { AppError } from "@/lib/errors";
import { readJson, removeKey, writeJson } from "@/lib/storage";

/** Server-side session of the mock backend (stands in for the HttpOnly cookie). */
const SESSION_KEY = "tenno.mock-session";

export function readMockSession(): { userId: string } | null {
  return readJson<{ userId: string }>(SESSION_KEY);
}

export function writeMockSession(userId: string): void {
  writeJson(SESSION_KEY, { userId });
}

export function clearMockSession(): void {
  removeKey(SESSION_KEY);
}

/** Signed-in user id, or an `unauthenticated` error like a 401. */
export function requireViewerId(): string {
  const session = readMockSession();
  if (!session) throw new AppError("unauthenticated", "Your session has expired. Sign in again.");
  return session.userId;
}
