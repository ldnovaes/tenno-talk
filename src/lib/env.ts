/** Typed access to build-time configuration (only public VITE_* values). */
export type DataSource = "mock" | "http";

export const env = {
  dataSource: (__USE_HTTP__ ? "http" : "mock") as DataSource,
  isDev: import.meta.env.DEV,
  termsVersion: "2026-10-03",
} as const;
