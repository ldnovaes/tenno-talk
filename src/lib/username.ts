/** Username rules (PLAN.md §34.2 — provisional): 3–20 chars, lowercase letters, digits, "_" and ".". */
export const USERNAME_PATTERN = /^[a-z][a-z0-9_.]{2,19}$/;

const RESERVED = new Set([
  "admin",
  "root",
  "support",
  "tenno",
  "tennotalk",
  "settings",
  "me",
  "api",
]);

export type UsernameProblem = "length" | "format" | "dots" | "reserved";

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function validateUsername(value: string): UsernameProblem | null {
  const username = normalizeUsername(value);
  if (username.length < 3 || username.length > 20) return "length";
  if (!USERNAME_PATTERN.test(username)) return "format";
  if (username.includes("..") || username.endsWith(".")) return "dots";
  if (RESERVED.has(username)) return "reserved";
  return null;
}
