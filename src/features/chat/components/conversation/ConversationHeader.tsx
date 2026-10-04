import { ArrowLeft, Bell, BellOff, MoreVertical, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { usePresence, useTypingUsers } from "@/stores/presenceStore";
import type { Conversation } from "@/types/conversation";

import { useMuteConversation } from "../../hooks/useMessageMutations";
import {
  conversationAvatar,
  conversationTitle,
  isMuted,
  otherMember,
} from "../../lib/conversationFilters";
import { GroupInfoDialog } from "./GroupInfoDialog";
import { PresenceSubtitle } from "./PresenceSubtitle";

export function ConversationHeader({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openOverlay = useOverlayNavigate();
  const isMobile = useIsMobile();
  const mute = useMuteConversation();
  const other = otherMember(conversation, viewerId);
  const presence = usePresence(other?.user.id, {
    isOnline: other?.isOnline ?? false,
    lastSeenAt: other?.lastSeenAt ?? null,
  });
  const typing = useTypingUsers(conversation.id);
  const title = conversationTitle(conversation, viewerId);
  const muted = isMuted(conversation);
  const [groupInfo, setGroupInfo] = useState(false);
  const openProfile = () =>
    other ? openOverlay(paths.profile(other.user.username)) : setGroupInfo(true);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2 md:px-4">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(paths.chats())}
          aria-label={t("common.back")}
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Button>
      )}
      <button
        type="button"
        onClick={openProfile}
        aria-label={other ? t("chat.header.openProfile", { name: title }) : t("groups.info")}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-start"
      >
        <UserAvatar
          user={conversationAvatar(conversation, viewerId)}
          size="sm"
          online={presence.isOnline}
        />
        <span className="min-w-0">
          <span className="block truncate font-semibold leading-tight">{title}</span>
          <PresenceSubtitle
            conversation={conversation}
            presence={presence}
            typingUserIds={typing}
          />
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-disabled="true"
            aria-label={t("chat.header.callSoon")}
            onClick={(event) => event.preventDefault()}
            className="cursor-not-allowed opacity-50"
          >
            <Phone className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("chat.header.callSoon")}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("chat.header.menu")}>
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {other && (
            <DropdownMenuItem onSelect={openProfile}>
              <UserRound className="size-4" aria-hidden />
              {t("chat.header.viewProfile")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => mute.mutate({ conversationId: conversation.id, muted: !muted })}
          >
            {muted ? (
              <Bell className="size-4" aria-hidden />
            ) : (
              <BellOff className="size-4" aria-hidden />
            )}
            {muted ? t("chat.header.unmute") : t("chat.header.mute")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {conversation.kind === "group" && (
        <GroupInfoDialog
          conversation={conversation}
          viewerId={viewerId}
          open={groupInfo}
          onOpenChange={setGroupInfo}
        />
      )}
    </header>
  );
}
