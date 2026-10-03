import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // Phase 8: the Java backend runs on :8080; same-origin in dev through this proxy.
    proxy: {
      "/api": "http://localhost:8080",
      "/oauth2": "http://localhost:8080",
      "/login/oauth2": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});
