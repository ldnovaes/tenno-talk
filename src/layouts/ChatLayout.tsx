import type { ReactNode } from "react";
import { Outlet, useMatch } from "react-router";

import { useIsMobile } from "@/hooks/useBreakpoint";

/**
 * Two panes on md+ (list | conversation). On mobile only one is visible:
 * the list on /chats, the conversation on /chats/:id (PLAN.md §6).
 */
export function ChatLayout({ list }: { list: ReactNode }) {
  const isMobile = useIsMobile();
  const inConversation = useMatch("/chats/:conversationId") !== null;

  if (isMobile) {
    return <div className="flex min-h-0 flex-1 flex-col">{inConversation ? <Outlet /> : list}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[300px] shrink-0 flex-col border-e bg-background lg:w-[360px] xl:w-[400px]">
        {list}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-chat-bg">
        <Outlet />
      </section>
    </div>
  );
}
