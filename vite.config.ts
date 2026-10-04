import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const MOCK_MODULES = ["/src/services/mock/", "/src/services/realtime/mockRealtimeClient"];

export default defineConfig(({ mode }) => {
  const useHttp = loadEnv(mode, process.cwd(), "VITE_")["VITE_DATA_SOURCE"] === "http";
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    define: { __USE_HTTP__: JSON.stringify(useHttp) },
    build: {
      rollupOptions: {
        // With the real backend, the mock modules are unused: let tree-shaking drop them entirely
        // even though they register listeners when imported.
        treeshake: {
          moduleSideEffects: (id: string) =>
            !(useHttp && MOCK_MODULES.some((part) => id.includes(part))),
        },
      },
    },
    server: {
      port: 5173,
      // The Java backend runs on :8080; same origin in development through this proxy.
      proxy: {
        "/api": "http://localhost:8080",
        "/oauth2": "http://localhost:8080",
        "/login/oauth2": "http://localhost:8080",
        "/ws": { target: "ws://localhost:8080", ws: true },
      },
    },
  };
});
