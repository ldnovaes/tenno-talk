export const adminKeys = {
  all: ["admin"] as const,
  ai: () => [...adminKeys.all, "ai"] as const,
  reports: (status: string) => [...adminKeys.all, "reports", status] as const,
};
