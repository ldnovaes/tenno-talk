export const authKeys = {
  oauthProviders: () => ["auth", "oauth-providers"] as const,
};

export const profileKeys = {
  me: () => ["me"] as const,
  all: ["profiles"] as const,
  byUsername: (username: string) => ["profiles", "username", username] as const,
  suggestions: (limit: number) => ["profiles", "suggestions", limit] as const,
  blocked: () => ["profiles", "blocked"] as const,
  usernameCheck: (username: string) => ["profiles", "username-check", username] as const,
};
