import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useConversations } from "@/features/chat/hooks/useConversations";
import { totalUnread } from "@/features/chat/lib/conversationFilters";
import { useUnreadNotifications } from "@/features/notifications/hooks/useNotifications";
import { AppShell } from "@/layouts/AppShell";

/** Shell for onboarded users: realtime connection + navigation badges. */
export function ShellRoute() {
  const me = useCurrentUser();
  const conversations = useConversations();
  const notifications = useUnreadNotifications();
  const chats = conversations.data ? totalUnread(conversations.data) : 0;
  return <AppShell data={{ me, badges: { chats, notifications: notifications.data ?? 0 } }} />;
}
