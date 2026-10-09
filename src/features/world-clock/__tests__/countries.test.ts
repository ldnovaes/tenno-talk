import { describe, expect, it } from "vitest";

import { readerLocale, WORLD_CLOCK_PAIR } from "../lib/countries";

describe("readerLocale", () => {
  it("shows each country in the language of the other side of the pair", () => {
    expect(readerLocale(WORLD_CLOCK_PAIR, "br")).toBe("vi");
    expect(readerLocale(WORLD_CLOCK_PAIR, "vn")).toBe("pt-BR");
  });

  it("does not depend on the order of the pair", () => {
    expect(readerLocale(["vn", "br"], "br")).toBe("vi");
  });
});
