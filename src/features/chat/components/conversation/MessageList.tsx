import { Fragment, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState } from "@/components/common/ErrorState";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { useTypingUsers } from "@/stores/presenceStore";
import type { Conversation } from "@/types/conversation";

import { useMarkAsRead } from "../../hooks/useMarkAsRead";
import { useMessages } from "../../hooks/useMessages";
import { otherMember } from "../../lib/conversationFilters";
import { groupMessages } from "../../lib/groupMessages";
import { flattenMessages } from "../../lib/messageCache";
import { MessageBubble } from "../message/MessageBubble";
import { ConversationEmpty } from "./ConversationEmpty";
import { DayDivider } from "./DayDivider";
import { MessageListSkeleton } from "./MessageListSkeleton";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { TypingIndicator } from "./TypingIndicator";
import { useStickToBottom } from "./useStickToBottom";

export function MessageList({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  const { t } = useTranslation();
  const query = useMessages(conversation.id);
  const messages = useMemo(() => flattenMessages(query.data), [query.data]);
  const sections = useMemo(() => groupMessages(messages, new Date()), [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAtBottom, unseen, onScroll, scrollToBottom } = useStickToBottom(
    scrollRef,
    messages,
    viewerId,
  );
  const typing = useTypingUsers(conversation.id).length > 0;
  const isGroup = conversation.kind === "group";
  const members = useMemo(
    () => new Map(conversation.members.map((m) => [m.user.id, m.user])),
    [conversation.members],
  );

  useMarkAsRead(conversation.id, messages, viewerId, isAtBottom);

  if (query.isPending) return <MessageListSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} className="flex-1" />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="flex min-h-full flex-col justify-end py-2">
          {query.hasNextPage && (
            <>
              <InfiniteScrollTrigger
                onVisible={() => !query.isFetchingNextPage && void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                rootMargin="200px"
              />
              {query.isFetchingNextPage && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {t("chat.message.loadingOlder")}
                </p>
              )}
            </>
          )}
          {messages.length === 0 && (
            <ConversationEmpty other={otherMember(conversation, viewerId)} />
          )}
          <div role="log" aria-live="polite" aria-label={t("chat.message.log")}>
            {sections.map((section) => (
              <Fragment key={section.key}>
                <DayDivider label={section.label} />
                {section.groups.map((group) =>
                  group.messages.map(({ message, position }) => (
                    <MessageBubble
                      key={message.clientId ?? message.id}
                      message={message}
                      position={position}
                      sender={isGroup ? (members.get(message.senderId) ?? null) : null}
                    />
                  )),
                )}
              </Fragment>
            ))}
          </div>
          {typing && <TypingIndicator />}
        </div>
      </div>
      {!isAtBottom && (
        <ScrollToBottomButton unseen={unseen} onClick={() => scrollToBottom("smooth")} />
      )}
    </div>
  );
}
