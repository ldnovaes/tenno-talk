import { MutationObserver } from "@tanstack/react-query";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/app/queryClient";
import { AppError, type AppErrorCode } from "@/lib/errors";
import { useSessionStore } from "@/stores/sessionStore";
import { caseName, cartesian } from "@/test/combinations";

const CODES: AppErrorCode[] = [
  "network",
  "unauthenticated",
  "not_found",
  "forbidden",
  "validation",
  "conflict",
  "rate_limited",
  "unknown",
];

afterEach(() => vi.restoreAllMocks());

function signedIn() {
  useSessionStore.setState({ status: "authenticated", userId: "u1" });
}

/**
 * PLAN.md §11.3, §19: an expired session (401) always signs out, without a toast. Other errors toast,
 * except a first load (the screen shows its own error state) and anything marked silent.
 */
describe("global error policy (code × query/mutation × first load/refetch × silent)", () => {
  const rows = cartesian({
    code: CODES,
    kind: ["query", "mutation"] as const,
    loaded: [false, true],
    silent: [false, true],
  }).filter((row) => row.kind === "query" || !row.loaded);

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", async (_name, row) => {
    signedIn();
    const toastError = vi.spyOn(toast, "error");
    const client = createQueryClient();
    const error = new AppError(row.code, `boom ${row.code}`);
    const meta = row.silent ? { silent: true } : undefined;

    if (row.kind === "query") {
      if (row.loaded) client.setQueryData(["q"], "cached");
      await client
        .fetchQuery({
          queryKey: ["q"],
          queryFn: () => Promise.reject(error),
          retry: false,
          staleTime: 0,
          ...(meta ? { meta } : {}),
        })
        .catch(() => undefined);
    } else {
      const observer = new MutationObserver(client, {
        mutationFn: () => Promise.reject(error),
        ...(meta ? { meta } : {}),
      });
      await observer.mutate().catch(() => undefined);
    }

    const signsOut = row.code === "unauthenticated";
    const toasts = !signsOut && !row.silent && (row.kind === "mutation" || row.loaded);
    expect(useSessionStore.getState().status).toBe(signsOut ? "anonymous" : "authenticated");
    expect(toastError).toHaveBeenCalledTimes(toasts ? 1 : 0);
    if (toasts) expect(toastError).toHaveBeenCalledWith(`boom ${row.code}`);
  });
});

describe("query retry", () => {
  it.each(CODES)("%s", (code) => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") throw new Error("retry must be a function");
    const error = new AppError(code, "x");
    // One more attempt for problems that can go away by themselves; never a second one.
    expect(retry(0, error)).toBe(error.retryable);
    expect(retry(1, error)).toBe(false);
  });

  it("mutations are never retried automatically", () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(0);
  });
});
