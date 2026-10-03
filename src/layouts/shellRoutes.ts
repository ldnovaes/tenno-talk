import { matchPath } from "react-router";

/** Routes that take the whole mobile screen (no bottom nav). */
const FULLSCREEN_MOBILE = [
  "/chats/:conversationId",
  "/settings/:section",
  "/u/:username/edit",
  "/create",
  "/notifications",
  "/admin/ai",
];

export function hidesBottomNav(pathname: string): boolean {
  return FULLSCREEN_MOBILE.some((pattern) => matchPath(pattern, pathname) !== null);
}
