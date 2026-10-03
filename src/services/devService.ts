import { env } from "@/lib/env";

import { mockDb } from "./mock/db";

/** Developer helpers, only meaningful with the mock data source. */
export const devService = {
  available: env.dataSource === "mock",
  resetDemoData(): void {
    mockDb.reset();
  },
};
