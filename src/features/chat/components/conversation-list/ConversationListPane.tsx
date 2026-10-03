import { MessageCircle, SquarePen } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/useMe";

import { useConversations } from "../../hooks/useConversations";
import { filterConversations, type ConversationFilter } from "../../lib/conversationFilters";
import { ConversationFilters } from "./ConversationFilters";
import { ConversationListItem } from "./ConversationListItem";
import { ConversationListSkeleton } from "./ConversationListSkeleton";
import { ConversationSearch } from "./ConversationSearch";
import { NewChatDialog } from "./NewChatDialog";

/** Moves focus between conversation links with ↑/↓ (PLAN.md §20). */
function handleListKeys(event: KeyboardEvent<HTMLUListElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
  const index = links.findIndex((link) => link === document.activeElement);
  const next = links[event.key === "ArrowDown" ? index + 1 : Math.max(0, index - 1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

export function ConversationListPane({ header }: { header?: ReactNode }) {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const conversations = useConversations();
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const list = conversations.data;
  const visible = useMemo(
    () => (list ? filterConversations(list, { filter, query, viewerId: me.id }) : []),
    [list, filter, query, me.id],
  );
  const hasGroups = list?.some((conversation) => conversation.kind === "group") ?? false;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <h1 className="text-[22px] font-bold">{t("chat.title")}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNewChatOpen(true)}
          aria-label={t("chat.newChat")}
        >
          <SquarePen className="size-5" />
        </Button>
      </div>
      {header}
      <ConversationSearch ref={searchRef} value={query} onChange={setQuery} />
      <ConversationFilters value={filter} onChange={setFilter} showGroups={hasGroups} />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.isPending && <ConversationListSkeleton />}
        {conversations.isError && <ErrorState onRetry={() => void conversations.refetch()} />}
        {list?.length === 0 && (
          <EmptyState
            icon={MessageCircle}
            title={t("chat.empty.title")}
            description={t("chat.empty.description")}
            action={
              <Button asChild>
                <Link to={paths.discover()}>{t("chat.empty.action")}</Link>
              </Button>
            }
          />
        )}
        {list && list.length > 0 && visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {filter === "unread" && !query
              ? t("chat.empty.unreadTitle")
              : t("chat.empty.noResults")}
          </p>
        )}
        <ul aria-label={t("chat.title")} onKeyDown={handleListKeys}>
          {visible.map((conversation) => (
            <li key={conversation.id}>
              <ConversationListItem conversation={conversation} viewerId={me.id} />
            </li>
          ))}
        </ul>
      </div>
      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
    </div>
  );
}
