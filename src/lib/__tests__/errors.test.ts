import { describe, expect, it } from "vitest";

import { AppError, isAppError, toAppError } from "@/lib/errors";

describe("AppError", () => {
  it("marks retryable codes", () => {
    expect(new AppError("network", "x").retryable).toBe(true);
    expect(new AppError("rate_limited", "x").retryable).toBe(true);
    expect(new AppError("validation", "x").retryable).toBe(false);
    expect(new AppError("forbidden", "x").retryable).toBe(false);
  });

  it("keeps field errors", () => {
    const error = new AppError("validation", "bad", { fieldErrors: { username: "taken" } });
    expect(error.fieldErrors["username"]).toBe("taken");
  });
});

describe("toAppError", () => {
  it("returns AppError untouched", () => {
    const error = new AppError("conflict", "x");
    expect(toAppError(error)).toBe(error);
  });

  it("maps fetch TypeError to network", () => {
    expect(toAppError(new TypeError("Failed to fetch")).code).toBe("network");
  });

  it("wraps unknown values", () => {
    expect(toAppError(new Error("boom")).message).toBe("boom");
    expect(toAppError("weird").code).toBe("unknown");
    expect(isAppError(toAppError(42))).toBe(true);
  });
});
