import { describe, expect, it } from "vitest";

import { createMockStore } from "@/services/mock/createMockStore";
import { mockRequest, setMockConfig } from "@/services/mock/latency";

describe("createMockStore", () => {
  const seed = () => ({ items: ["a"] });

  it("persists updates and reloads them", () => {
    const store = createMockStore({ key: "test.store", version: 1, seed });
    store.update((state) => state.items.push("b"));
    const reloaded = createMockStore({ key: "test.store", version: 1, seed });
    expect(reloaded.read().items).toEqual(["a", "b"]);
  });

  it("discards data from another version", () => {
    createMockStore({ key: "test.store", version: 1, seed }).update((s) => s.items.push("b"));
    expect(createMockStore({ key: "test.store", version: 2, seed }).read().items).toEqual(["a"]);
  });

  it("resets to the seed and notifies subscribers", () => {
    const store = createMockStore({ key: "test.store", version: 1, seed });
    let calls = 0;
    store.subscribe(() => calls++);
    store.update((s) => s.items.push("b"));
    store.reset();
    expect(store.read().items).toEqual(["a"]);
    expect(calls).toBe(2);
  });
});

describe("mockRequest", () => {
  it("returns a deep copy", async () => {
    const source = { nested: { value: 1 } };
    const result = await mockRequest(() => source);
    result.nested.value = 2;
    expect(source.nested.value).toBe(1);
  });

  it("fails with a network AppError when configured", async () => {
    setMockConfig({ failureRate: 1 });
    await expect(mockRequest(() => 1)).rejects.toMatchObject({ code: "network" });
  });
});

describe("createMockStore across tabs", () => {
  it("re-applies a change when another tab wrote in the meantime", () => {
    const seed = () => ({ items: ["a"] });
    const tabA = createMockStore({ key: "test.concurrent", version: 1, seed });
    const tabB = createMockStore({ key: "test.concurrent", version: 1, seed });
    tabA.update((s) => s.items.push("from A"));
    let runs = 0;
    tabB.update((s) => {
      runs += 1;
      // Tab A writes while tab B is in the middle of its change.
      if (runs === 1) tabA.update((a) => a.items.push("A again"));
      s.items.push("from B");
    });
    expect(runs).toBe(2);
    const fresh = createMockStore({ key: "test.concurrent", version: 1, seed });
    expect(fresh.read().items).toEqual(["a", "from A", "A again", "from B"]);
  });
});
