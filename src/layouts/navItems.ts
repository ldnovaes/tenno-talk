import { Bell, Compass, LayoutGrid, MessageCircle, type LucideIcon } from "lucide-react";

import { paths } from "@/app/router/paths";

export type NavKey = "chats" | "discover" | "feed" | "notifications";

export interface NavItem {
  key: NavKey;
  to: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { key: "chats", to: paths.chats(), icon: MessageCircle },
  { key: "discover", to: paths.discover(), icon: Compass },
  { key: "feed", to: paths.feed(), icon: LayoutGrid },
  { key: "notifications", to: paths.notifications(), icon: Bell },
];
