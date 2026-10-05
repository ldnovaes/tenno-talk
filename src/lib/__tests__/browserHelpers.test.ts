import { afterEach, describe, expect, it, vi } from "vitest";

import { COUNTRY_CODES, getCountryName } from "@/lib/countries";
import { formatTime } from "@/lib/dates";
import { validateImageFile } from "@/lib/images";
import { readJson, removeKey, writeJson } from "@/lib/storage";

afterEach(() => vi.restoreAllMocks());

describe("validateImageFile", () => {
  const LIMIT = 5 * 1024 * 1024;
  const file = (type: string, size: number) => new File([new Uint8Array(size)], "x", { type });

  it.each([
    ["png", "image/png", 10, null],
    ["heic", "image/heic", 10, null],
    ["exactly 5 MB", "image/jpeg", LIMIT, null],
    ["one byte over", "image/jpeg", LIMIT + 1, "tooLarge"],
    ["pdf", "application/pdf", 10, "invalid"],
    ["no type", "", 10, "invalid"],
    ["svg is still an image here (the server refuses it)", "image/svg+xml", 10, null],
  ] as const)("%s → %s", (_name, type, size, problem) => {
    expect(validateImageFile(file(type, size))).toBe(problem);
  });
});

describe("storage", () => {
  it("round-trips JSON in local and session storage", () => {
    writeJson("k", { a: 1 });
    writeJson("k", [1], "session");
    expect(readJson("k")).toEqual({ a: 1 });
    expect(readJson("k", "session")).toEqual([1]);
    removeKey("k");
    expect(readJson("k")).toBeNull();
  });

  it("reads corrupt or missing values as null", () => {
    localStorage.setItem("bad", "{not json");
    expect(readJson("bad")).toBeNull();
    expect(readJson("missing")).toBeNull();
  });

  it("never throws when the quota is exceeded", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => writeJson("k", "v")).not.toThrow();
  });

  it("never throws when storage is blocked (privacy settings)", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readJson("k")).toBeNull();
    expect(() => writeJson("k", 1)).not.toThrow();
    expect(() => removeKey("k")).not.toThrow();
  });
});

describe("getCountryName", () => {
  it.each(COUNTRY_CODES)("%s has a name", (code) => {
    expect(getCountryName(code)).not.toBe(code);
  });

  it("localizes and falls back to the code", () => {
    expect(getCountryName("BR", "pt-BR")).toBe("Brasil");
    expect(getCountryName("BR", "not a locale!")).toBe("BR");
  });
});

describe("formatTime", () => {
  it("shows 24-hour local time", () => {
    expect(formatTime(new Date(2026, 9, 5, 9, 5).toISOString())).toBe("09:05");
    expect(formatTime(new Date(2026, 9, 5, 21, 40).toISOString())).toBe("21:40");
  });
});
