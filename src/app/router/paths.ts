/** URL builders. Components never hand-build route strings (PLAN.md §8.3). */
export const SETTINGS_SECTIONS = [
  "account",
  "language",
  "translation",
  "appearance",
  "privacy",
  "notifications",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const ONBOARDING_STEPS = [
  "welcome",
  "native-language",
  "receive-language",
  "profile",
  "discover",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section === value);
}

export function isOnboardingStep(value: string | undefined): value is OnboardingStep {
  return ONBOARDING_STEPS.some((step) => step === value);
}

export const paths = {
  home: () => "/",
  welcome: () => "/welcome",
  signIn: () => "/signin",
  signUp: () => "/signup",
  terms: () => "/terms",
  privacy: () => "/privacy",
  onboarding: (step: OnboardingStep = "welcome") => `/onboarding/${step}`,
  chats: () => "/chats",
  conversation: (conversationId: string) => `/chats/${encodeURIComponent(conversationId)}`,
  discover: () => "/discover",
  feed: () => "/feed",
  notifications: () => "/notifications",
  create: () => "/create",
  story: (userId: string) => `/stories/${encodeURIComponent(userId)}`,
  profile: (username: string) => `/u/${encodeURIComponent(username)}`,
  editProfile: (username: string) => `/u/${encodeURIComponent(username)}/edit`,
  settings: (section?: SettingsSection) => (section ? `/settings/${section}` : "/settings"),
  adminAi: () => "/admin/ai",
  adminReports: () => "/admin/reports",
} as const;
