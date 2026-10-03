export const adminKeys = {
  all: ["admin"] as const,
  ai: () => [...adminKeys.all, "ai"] as const,
};
