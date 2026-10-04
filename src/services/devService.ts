/** Developer helpers, only meaningful with the mock data source. */
export const devService = {
  available: !__USE_HTTP__,
  /** Loaded on demand, so the mock database never ships with the real build. */
  async resetDemoData(): Promise<void> {
    const { mockDb } = await import("./mock/db");
    mockDb.reset();
  },
};
