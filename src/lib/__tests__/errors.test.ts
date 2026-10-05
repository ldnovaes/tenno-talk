import { describe, expect, it } from "vitest";

import { AppError, isAppError, toAppError, type AppErrorCode } from "@/lib/errors";

describe("AppError", () => {
  // PLAN.md §19: only problems that can go away by themselves are retried.
  it.each([
    ["network", true],
    ["rate_limited", true],
    ["unknown", true],
    ["unauthenticated", false],
    ["not_found", false],
    ["forbidden", false],
    ["validation", false],
    ["conflict", false],
  ] as [AppErrorCode, boolean][])("%s retryable=%s", (code, retryable) => {
    expect(new AppError(code, "x").retryable).toBe(retryable);
  });

  it("keeps field errors, and none by default", () => {
    const error = new AppError("validation", "bad", { fieldErrors: { username: "taken" } });
    expect(error.fieldErrors["username"]).toBe("taken");
    expect(new AppError("validation", "bad").fieldErrors).toEqual({});
  });
});

describe("toAppError", () => {
  it("returns AppError untouched", () => {
    const error = new AppError("conflict", "x");
    expect(toAppError(error)).toBe(error);
  });

  it("maps fetch TypeError to network, keeping the cause", () => {
    const cause = new TypeError("Failed to fetch");
    const error = toAppError(cause);
    expect(error.code).toBe("network");
    expect(error.cause).toBe(cause);
  });

  it("wraps unknown values", () => {
    expect(toAppError(new Error("boom")).message).toBe("boom");
    expect(toAppError(new Error("boom")).code).toBe("unknown");
    expect(toAppError("weird").code).toBe("unknown");
    expect(toAppError(null).message).toBe("Something went wrong.");
    expect(isAppError(toAppError(42))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
  });
});
