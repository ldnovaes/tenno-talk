import { AppError } from "@/lib/errors";
import { readJson, removeKey, writeJson } from "@/lib/storage";

/**
 * Server-side session of the mock backend (stands in for the HttpOnly cookie).
 * Per tab (sessionStorage): open Lucas in one tab and Cam in another to chat.
 */
const SESSION_KEY = "tenno.mock-session";

export function readMockSession(): { userId: string } | null {
  return readJson<{ userId: string }>(SESSION_KEY, "session");
}

export function writeMockSession(userId: string): void {
  writeJson(SESSION_KEY, { userId }, "session");
}

export function clearMockSession(): void {
  removeKey(SESSION_KEY, "session");
}

/** Signed-in user id, or an `unauthenticated` error like a 401. */
export function requireViewerId(): string {
  const session = readMockSession();
  if (!session) throw new AppError("unauthenticated", "Your session has expired. Sign in again.");
  return session.userId;
}
