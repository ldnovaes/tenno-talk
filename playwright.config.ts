import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (PLAN.md §23) against the mock backend: no server needed, deterministic data.
 * The real backend is covered by the Java integration tests and the smoke run in e2e/README.md.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  testIgnore: "stack/**",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env["CI"],
    env: { VITE_DATA_SOURCE: "mock" },
  },
});
