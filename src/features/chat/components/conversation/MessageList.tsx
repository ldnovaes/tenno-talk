import { Fragment, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
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
  const [params] = useSearchParams();
  const target = params.get("messageId");
  const located = useRef<string | null>(null);
  const messages = useMemo(() => flattenMessages(query.data), [query.data]);
  const sections = useMemo(() => groupMessages(messages, new Date()), [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isAtBottom, unseen, onScroll, scrollToBottom } = useStickToBottom(
    scrollRef,
    contentRef,
    messages,
    viewerId,
  );
  const typing = useTypingUsers(conversation.id).length > 0;
  const isGroup = conversation.kind === "group";
  const members = useMemo(
    () => new Map(conversation.members.map((m) => [m.user.id, m.user])),
    [conversation.members],
  );

  useEffect(() => {
    if (!target || located.current === target) return;
    if (messages.some((message) => message.id === target)) {
      const frame = requestAnimationFrame(() => {
        const element = document.getElementById(`message-${target}`);
        element?.scrollIntoView?.({ block: "center" });
        element?.classList.add("bg-primary/10");
        located.current = target;
      });
      return () => cancelAnimationFrame(frame);
    }
    if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
    return undefined;
  }, [target, messages, query]);
  useMarkAsRead(conversation.id, messages, viewerId, isAtBottom && !target);

  if (query.isPending) return <MessageListSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} className="flex-1" />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div ref={contentRef} className="flex min-h-full flex-col justify-end py-3">
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
