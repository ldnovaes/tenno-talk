export const feedKeys = {
  all: ["feed"] as const,
  list: () => ["feed", "list"] as const,
  user: (userId: string) => ["feed", "user", userId] as const,
  post: (postId: string) => ["feed", "post", postId] as const,
  comments: (postId: string) => ["feed", "comments", postId] as const,
};
