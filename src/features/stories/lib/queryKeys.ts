export const storyKeys = {
  all: ["stories"] as const,
  user: (id: string) => ["stories", "user", id] as const,
  item: (id: string) => ["stories", "item", id] as const,
  tray: () => ["stories", "tray"] as const,
};
