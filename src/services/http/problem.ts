import { AppError, type AppErrorCode } from "@/lib/errors";

const CODES: ReadonlySet<string> = new Set<AppErrorCode>([
  "unauthenticated",
  "not_found",
  "forbidden",
  "validation",
  "conflict",
  "rate_limited",
  "unknown",
]);

function codeFromStatus(status: number): AppErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "validation";
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

/** Retry-After in seconds or as an HTTP date (RFC 9110 §10.2.3), in milliseconds from now. */
function retryAfterMs(header: string | null | undefined, now: number): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.ceil(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) || !/[a-z]/i.test(trimmed) ? null : Math.max(0, date - now);
}

/** Maps an RFC 9457 Problem Details body (with our `code`/`fieldErrors` extensions) to AppError. */
export function problemToAppError(
  status: number,
  body: unknown,
  retryAfter: string | null = null,
  now: number = Date.now(),
): AppError {
  const problem = isRecord(body) ? body : {};
  const declared = typeof problem["code"] === "string" ? problem["code"] : null;
  const code =
    declared !== null && CODES.has(declared) ? (declared as AppErrorCode) : codeFromStatus(status);
  const detail = typeof problem["detail"] === "string" ? problem["detail"] : null;
  return new AppError(code, detail ?? "Something went wrong.", {
    fieldErrors: stringRecord(problem["fieldErrors"]),
    retryAfterMs: retryAfterMs(retryAfter, now),
  });
}
