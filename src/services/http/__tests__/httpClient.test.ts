import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

import { http, readCookie, withQuery } from "../httpClient";
import { problemToAppError } from "../problem";
import { resolveAvatarUrl } from "../media";

function jsonResponse(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readCookie", () => {
  it("finds a cookie among others and decodes it", () => {
    expect(readCookie("XSRF-TOKEN", "a=1; XSRF-TOKEN=abc%3D%3D; b=2")).toBe("abc==");
  });

  it("returns null when missing", () => {
    expect(readCookie("XSRF-TOKEN", "a=1")).toBeNull();
    expect(readCookie("XSRF-TOKEN", "")).toBeNull();
  });

  it("keeps '=' inside values", () => {
    expect(readCookie("t", "t=a=b")).toBe("a=b");
  });
});

describe("withQuery", () => {
  it("drops null and undefined values", () => {
    expect(withQuery("/api/feed", { cursor: null, limit: 5, q: undefined })).toBe(
      "/api/feed?limit=5",
    );
  });

  it("encodes values", () => {
    expect(withQuery("/api/people/search", { q: "lê & ana" })).toBe(
      "/api/people/search?q=l%C3%AA+%26+ana",
    );
  });

  it("leaves the path alone without parameters", () => {
    expect(withQuery("/api/feed", undefined)).toBe("/api/feed");
    expect(withQuery("/api/feed", { cursor: null })).toBe("/api/feed");
  });
});

describe("problemToAppError", () => {
  it("uses the code and field errors from the problem", () => {
    const error = problemToAppError(400, {
      status: 400,
      detail: "Check the highlighted fields.",
      code: "validation",
      fieldErrors: { email: "taken", bad: 3 },
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("validation");
    expect(error.message).toBe("Check the highlighted fields.");
    expect(error.fieldErrors).toEqual({ email: "taken" });
    expect(error.retryable).toBe(false);
  });

  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [413, "validation"],
    [429, "rate_limited"],
    [500, "unknown"],
    [502, "unknown"],
  ])("falls back to the HTTP status %i → %s", (status, code) => {
    expect(problemToAppError(status, "<html>Bad gateway</html>").code).toBe(code);
  });

  it("ignores unknown codes from the server", () => {
    expect(problemToAppError(403, { code: "something_new" }).code).toBe("forbidden");
  });

  it("rate limits and server errors are retryable", () => {
    expect(problemToAppError(429, {}).retryable).toBe(true);
    expect(problemToAppError(500, {}).retryable).toBe(true);
  });
});

describe("http", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "XSRF-TOKEN=token-123; path=/";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("GETs JSON with the session cookie and no CSRF header", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [], nextCursor: null }));
    await expect(http("GET", "/api/feed", { query: { cursor: "c1" } })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/feed?cursor=c1");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.headers).not.toHaveProperty("X-XSRF-TOKEN");
  });

  it("sends the CSRF token and a JSON body on writes", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "p1" }));
    await http("POST", "/api/posts", { body: { caption: "Oi" } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ caption: "Oi" }));
    expect(init?.headers).toMatchObject({
      "X-XSRF-TOKEN": "token-123",
      "Content-Type": "application/json",
    });
  });

  it("resolves 204 with undefined", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(http("POST", "/api/auth/signout")).resolves.toBeUndefined();
  });

  it("rejects with the server's problem", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { code: "forbidden", detail: "Comments are limited on this post." }),
    );
    await expect(
      http("POST", "/api/posts/1/comments", { body: { text: "x" } }),
    ).rejects.toMatchObject({
      code: "forbidden",
      message: "Comments are limited on this post.",
    });
  });

  it("turns connection failures into retryable network errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await http("GET", "/api/me").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "network", retryable: true });
  });
});

describe("resolveAvatarUrl", () => {
  it("keeps server URLs and null as they are", async () => {
    await expect(resolveAvatarUrl(null)).resolves.toBeNull();
    await expect(resolveAvatarUrl("/api/media/abc")).resolves.toBe("/api/media/abc");
  });
});
