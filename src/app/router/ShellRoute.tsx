import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useConversations } from "@/features/chat/hooks/useConversations";
import { useRealtimeBridge } from "@/features/chat/hooks/useRealtimeBridge";
import { totalUnread } from "@/features/chat/lib/conversationFilters";
import {
  useNotificationsRealtime,
  useUnreadNotifications,
} from "@/features/notifications/hooks/useNotifications";
import { AppShell } from "@/layouts/AppShell";

/** Shell for onboarded users: realtime connection + navigation badges. */
export function ShellRoute() {
  const me = useCurrentUser();
  const conversations = useConversations();
  const notifications = useUnreadNotifications();
  useRealtimeBridge(me.id);
  useNotificationsRealtime();
  const chats = conversations.data ? totalUnread(conversations.data) : 0;
  return <AppShell data={{ me, badges: { chats, notifications: notifications.data ?? 0 } }} />;
}
