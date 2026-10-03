import { BellOff } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { paths } from "@/app/router/paths";
import { RelativeTime } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/common/UserAvatar";
import { cn } from "@/lib/utils";
import { usePresence, useTypingUsers } from "@/stores/presenceStore";
import type { Conversation } from "@/types/conversation";

import {
  conversationAvatar,
  conversationTitle,
  isMuted,
  otherMember,
} from "../../lib/conversationFilters";
import { previewText } from "../../lib/previewText";
import { DeliveryTicks } from "../message/DeliveryTicks";

interface ConversationListItemProps {
  conversation: Conversation;
  viewerId: string;
}

function ConversationListItemComponent({ conversation, viewerId }: ConversationListItemProps) {
  const { t } = useTranslation();
  const other = otherMember(conversation, viewerId);
  const presence = usePresence(other?.user.id, {
    isOnline: other?.isOnline ?? false,
    lastSeenAt: other?.lastSeenAt ?? null,
  });
  const typing = useTypingUsers(conversation.id).length > 0;
  const title = conversationTitle(conversation, viewerId);
  const last = conversation.lastMessage;
  const muted = isMuted(conversation);
  const preview = last
    ? previewText(last, viewerId, {
        you: (text) => t("chat.preview.you", { text }),
        media: {
          photo: t("chat.preview.photo"),
          video: t("chat.preview.video"),
          audio: t("chat.preview.audio"),
          file: t("chat.preview.file"),
        },
      })
    : t("chat.preview.noMessages");
  const previewLanguage =
    last && last.senderId !== viewerId && last.translation?.status === "translated"
      ? last.translation.targetLanguage
      : undefined;

  return (
    <NavLink
      to={paths.conversation(conversation.id)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 outline-offset-[-2px] transition-colors hover:bg-muted",
          isActive && "bg-accent hover:bg-accent",
        )
      }
    >
      <UserAvatar user={conversationAvatar(conversation, viewerId)} online={presence.isOnline} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{title}</span>
          {muted && (
            <BellOff
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label={t("chat.list.muted")}
            />
          )}
          <span className="ms-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {last && last.senderId === viewerId && <DeliveryTicks status={last.deliveryStatus} />}
            {last && <RelativeTime iso={last.createdAt} />}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {typing ? (
            <span className="truncate text-sm text-primary">{t("chat.preview.typing")}</span>
          ) : (
            <span
              className="truncate text-sm text-muted-foreground"
              lang={previewLanguage}
              dir="auto"
            >
              {preview}
            </span>
          )}
          {conversation.unreadCount > 0 && (
            <span
              className={cn(
                "ms-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-xs font-semibold text-primary-foreground",
                muted ? "bg-unread-muted" : "bg-unread",
              )}
              aria-label={t("chat.list.unread", { count: conversation.unreadCount })}
            >
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </NavLink>
  );
}

/** Memoized: the list re-renders on every cache patch (PLAN.md §22). */
export const ConversationListItem = memo(ConversationListItemComponent);
