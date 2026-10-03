export type AppErrorCode =
  | "network"
  | "unauthenticated"
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "unknown";

const RETRYABLE: ReadonlySet<AppErrorCode> = new Set(["network", "rate_limited", "unknown"]);

/** Normalized error thrown by every service (mock or real). PLAN.md §19. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(
    code: AppErrorCode,
    message: string,
    options: { fieldErrors?: Record<string, string>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof TypeError) {
    return new AppError("network", "Connection problem. Check your internet and try again.", {
      cause: error,
    });
  }
  if (error instanceof Error) return new AppError("unknown", error.message, { cause: error });
  return new AppError("unknown", "Something went wrong.", { cause: error });
}
