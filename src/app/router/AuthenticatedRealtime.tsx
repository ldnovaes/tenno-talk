import type { ReactNode } from "react";
import { useOutbox } from "@/features/chat/hooks/useOutbox";
import { useRealtimeBridge } from "@/features/chat/hooks/useRealtimeBridge";
import { useReleaseLiftedSends } from "@/features/chat/hooks/useReleaseLiftedSends";
import { useNotificationsRealtime } from "@/features/notifications/hooks/useNotifications";

export function AuthenticatedRealtime({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  useRealtimeBridge(userId);
  useOutbox(userId);
  useReleaseLiftedSends(userId);
  useNotificationsRealtime();
  return children;
}
