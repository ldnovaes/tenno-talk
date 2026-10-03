/** English UI strings. Every UI string goes through t() (PLAN.md §21). */
export const en = {
  app: {
    name: "TENNO TALK",
    tagline: "Talk to anyone. In your own language.",
  },
  common: {
    back: "Back",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    continue: "Continue",
    retry: "Try again",
    more: "More",
    loading: "Loading…",
    search: "Search",
    comingSoon: "Coming soon",
    you: "You",
    yesterday: "Yesterday",
    today: "Today",
  },
  nav: {
    main: "Main navigation",
    chats: "Chats",
    discover: "Discover",
    create: "Create",
    feed: "Feed",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings",
  },
  errors: {
    generic: "Something went wrong.",
    pageTitle: "This page didn't load",
    pageDescription: "Something went wrong on our end. You can try again.",
    appTitle: "Something went wrong",
    appDescription: "Reload the app to continue.",
    reload: "Reload",
    notFoundTitle: "Page not found",
    notFoundDescription: "The page you're looking for doesn't exist or has been moved.",
    goHome: "Go home",
  },
  placeholder: {
    title: "Under construction",
    description: "This screen is part of an upcoming phase.",
  },
} as const;

export type Messages = typeof en;
