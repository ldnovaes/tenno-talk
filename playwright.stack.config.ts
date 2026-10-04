import { defineConfig, devices } from "@playwright/test";

/**
 * The whole production stack (Caddy + SPA build + Java backend + PostgreSQL), see e2e/README.md.
 * Not part of `bun run e2e`: it needs the stack running at STACK_URL.
 */
export default defineConfig({
  testDir: "e2e/stack",
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env["STACK_URL"] ?? "https://localhost:8443",
    ignoreHTTPSErrors: true,
  },
});
