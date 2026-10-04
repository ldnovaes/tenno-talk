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
  // The production build, not the dev server: the dev server optimizes dependencies the first time
  // a lazy page opens and reloads the page mid-test. Never reuse a server already running: it may
  // serve an older build.
  webServer: {
    command: `vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_DATA_SOURCE: "mock" },
  },
});
