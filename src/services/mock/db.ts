import { createMockStore } from "./createMockStore";
import type { MockDatabase } from "./schema";
import { createSeed } from "./seed";

/** Bump when the seed shape changes; stale local data is discarded. */
export const MOCK_DB_VERSION = 8;

export const mockDb = createMockStore<MockDatabase>({
  key: "tenno.mockdb",
  version: MOCK_DB_VERSION,
  seed: () => createSeed(),
});
