/** Typed access to build-time configuration (only public VITE_* values). */
export type DataSource = "mock" | "http";

function readDataSource(): DataSource {
  const value = import.meta.env["VITE_DATA_SOURCE"];
  return value === "http" ? "http" : "mock";
}

export const env = {
  dataSource: readDataSource(),
  isDev: import.meta.env.DEV,
  termsVersion: "2026-10-03",
} as const;
