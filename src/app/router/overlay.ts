import { useCallback } from "react";
import { matchPath, useLocation, useNavigate, type Location } from "react-router";

import { useIsMobile } from "@/hooks/useBreakpoint";

import { useBack } from "./useBack";
import { paths } from "./paths";

/**
 * Overlay routes (PLAN.md §8.1): on md+ these open above the current screen
 * (side panel, dialog or viewer) while keeping their own URL.
 */
export const OVERLAY_PATTERNS = [
  "/u/:username",
  "/u/:username/edit",
  "/settings",
  "/settings/:section",
  "/create",
  "/posts/:postId",
  "/stories/:userId",
] as const;

export interface OverlayState {
  backgroundLocation?: Location;
}

export function isOverlayPath(pathname: string): boolean {
  return OVERLAY_PATTERNS.some((pattern) => matchPath(pattern, pathname) !== null);
}

export function readBackground(state: unknown): Location | undefined {
  if (state && typeof state === "object" && "backgroundLocation" in state) {
    return (state as OverlayState).backgroundLocation;
  }
  return undefined;
}

const DEFAULT_BACKGROUND: Location = {
  pathname: paths.chats(),
  search: "",
  hash: "",
  state: null,
  key: "overlay-default",
};

/**
 * Location rendered behind an overlay, or null when the current route renders
 * as a regular page (mobile, or not an overlay route).
 */
export function useBackgroundLocation(): Location | null {
  const location = useLocation();
  const isMobile = useIsMobile();
  if (!isOverlayPath(location.pathname)) return null;
  if (isMobile)
    return location.pathname.startsWith("/posts/")
      ? (readBackground(location.state) ?? null)
      : null;
  return readBackground(location.state) ?? DEFAULT_BACKGROUND;
}

/** Navigates to an overlay route, keeping the screen below as background. */
export function useOverlayNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (to: string, options: { replace?: boolean } = {}) => {
      const backgroundLocation = readBackground(location.state) ?? location;
      navigate(to, { replace: options.replace ?? false, state: { backgroundLocation } });
    },
    [location, navigate],
  );
}

/** Closes the current overlay: back in history when opened in-app, else to the background. */
export function useCloseOverlay() {
  const location = useLocation();
  const background = readBackground(location.state);
  return useBack(
    background
      ? background.pathname + background.search
      : location.pathname.startsWith("/posts/") || location.pathname.startsWith("/stories/")
        ? paths.feed()
        : paths.chats(),
  );
}
