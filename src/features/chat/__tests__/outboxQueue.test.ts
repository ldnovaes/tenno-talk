import { describe, expect, it } from "vitest";

import { dispatchable, liftedRestrictions, refusedIn } from "../lib/outboxQueue";

const entry = (key: string, conversationId: string, blocked = false, failureCode?: string) => ({
  key,
  blocked,
  ...(failureCode ? { failureCode } : {}),
  input: { conversationId },
});

describe("dispatchable", () => {
  it("lets a refused message stop holding the ones written after it", () => {
    const refused = entry("a", "c1", true, "forbidden");
    const next = entry("b", "c1");
    expect(dispatchable([refused, next])).toEqual([next]);
  });

  it("keeps entries waiting for a retry in order", () => {
    const retrying = entry("a", "c1");
    const next = entry("b", "c1");
    expect(dispatchable([retrying, next])).toEqual([retrying, next]);
  });
});

describe("refusedIn", () => {
  it("picks only the conversation's sends refused by the server", () => {
    const refused = entry("a", "c1", true, "forbidden");
    const tooLarge = entry("b", "c1", true, "validation");
    const elsewhere = entry("c", "c2", true, "forbidden");
    const pending = entry("d", "c1");
    expect(refusedIn([refused, tooLarge, elsewhere, pending], "c1")).toEqual([refused]);
  });
});

describe("liftedRestrictions", () => {
  it("reports conversations that could not send before and now can", () => {
    const before = new Map([
      ["c1", "followers_only" as const],
      ["c2", null],
      ["c3", "you_blocked" as const],
    ]);
    expect(
      liftedRestrictions(before, [
        { id: "c1", sendRestriction: null },
        { id: "c2", sendRestriction: null },
        { id: "c3", sendRestriction: "you_blocked" },
        { id: "c4", sendRestriction: null },
      ]),
    ).toEqual(["c1"]);
  });
});
