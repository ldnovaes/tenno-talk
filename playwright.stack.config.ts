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
    // Rehearsals: e.g. STACK_HOST_RULES="MAP tenno.eldialabs.com:443 127.0.0.1:8443" reaches a
    // local VM under the real domain name (cookies, CSP and the WebSocket origin check).
    launchOptions: {
      args: process.env["STACK_HOST_RULES"]
        ? [`--host-resolver-rules=${process.env["STACK_HOST_RULES"]}`]
        : [],
    },
  },
});
