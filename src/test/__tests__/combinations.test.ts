import { describe, expect, it } from "vitest";

import { caseName, cartesian } from "../combinations";

describe("cartesian", () => {
  it("yields every combination of the axes exactly once", () => {
    const rows = cartesian({ mode: ["a", "b", "c"], own: [true, false] });
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map((row) => caseName(row))).size).toBe(6);
    expect(rows).toContainEqual({ mode: "c", own: false });
  });

  it("an empty axis yields no rows, no axes yield one empty row", () => {
    expect(cartesian({ mode: ["a"], own: [] })).toEqual([]);
    expect(cartesian({})).toEqual([{}]);
  });

  it("names a case from its values", () => {
    expect(caseName({ mode: "both", own: true, at: null })).toBe("mode=both own=true at=null");
  });
});
