/** How long "Not now" keeps the push invitation away. */
export const PUSH_PROMPT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

/** "ask": the browser can show its permission prompt; "install": add to Home Screen first. */
export type PushOffer = "ask" | "install" | null;

export interface PushOfferState {
  /** The server has VAPID keys. */
  enabled: boolean;
  supported: boolean;
  /** iPhone/iPad in a browser tab: Web Push exists only for Home Screen apps. */
  needsInstall: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  dismissedAt: number | null;
  now: number;
}

/**
 * Invite only while asking can still succeed: a denied permission can be changed only in the
 * browser's site settings, and a subscribed device has nothing left to do.
 */
export function pushOffer(state: PushOfferState): PushOffer {
  if (!state.enabled || state.subscribed) return null;
  if (state.dismissedAt !== null && state.now - state.dismissedAt < PUSH_PROMPT_SNOOZE_MS)
    return null;
  if (state.needsInstall) return "install";
  if (!state.supported || state.permission !== "default") return null;
  return "ask";
}
