import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Two projects (PLAN.md §23.1): `mock` runs the app against the mock backend (the default build),
 * `http` compiles with `__USE_HTTP__` on, so the HTTP services, the outbox and the HTTP-only hooks
 * run against a fake `fetch`/XHR (`src/test/fakeServer.ts`). The flag is a compile-time define, so
 * it can't be switched at runtime inside one project.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    css: false,
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      reporter: ["text-summary", "html"],
    },
    projects: [
      {
        extends: true,
        define: { __USE_HTTP__: "false" },
        test: {
          name: "mock",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/**/*.http.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        define: { __USE_HTTP__: "true" },
        test: {
          name: "http",
          environment: "jsdom",
          setupFiles: ["./src/test/setupHttp.ts"],
          include: ["src/**/*.http.test.{ts,tsx}"],
        },
      },
    ],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
