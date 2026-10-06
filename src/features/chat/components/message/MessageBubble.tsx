import { memo } from "react";
import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import {
  useMessageTranslation,
  type MessageTranslationState,
} from "@/features/translation/hooks/useMessageTranslation";
import { useTranslationPreferences } from "@/features/translation/hooks/useTranslationPreferences";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";
import type { User } from "@/types/user";

import type { BubblePosition } from "../../lib/groupMessages";
import { originalOf } from "../../lib/messageText";
import { MessageActions } from "../actions/MessageActions";
import { useMessageActionsContext } from "../actions/messageActionsContext";
import { BubbleMeta } from "./BubbleMeta";
import { bubbleCorners } from "./bubbleStyles";
import { FileCard, ImageGrid, VideoPlayer } from "./content/MediaContent";
import { MessageText } from "./MessageText";
import { ReactionChips } from "./ReactionChips";
import { ReplyQuote } from "./ReplyQuote";
import { StoryReactionContent } from "./StoryReactionContent";
import { StoryReplyLabel } from "./StoryReplyLabel";

interface MessageBubbleProps {
  message: Message;
  position: BubblePosition;
  /** Group conversations show the sender's name and avatar. */
  sender: User | null;
}

function MessageContentView({
  message,
  own,
  translation,
}: {
  message: Message;
  own: boolean;
  translation: MessageTranslationState;
}) {
  const content = message.content;
  switch (content.type) {
    case "text":
      return <MessageText message={message} own={own} translation={translation} />;
    case "story_reply":
      return (
        <>
          <StoryReplyLabel />
          <MessageText message={message} own={own} translation={translation} />
        </>
      );
    case "image":
      return (
        <>
          <ImageGrid media={content.media} />
          {content.caption && (
            <div className="px-1.5 pt-1.5">
              <MessageText message={message} own={own} translation={translation} />
            </div>
          )}
        </>
      );
    case "video":
      return (
        <>
          <VideoPlayer media={content.media} />
          {content.caption && (
            <div className="px-1.5 pt-1.5">
              <MessageText message={message} own={own} translation={translation} />
            </div>
          )}
        </>
      );
    case "file":
      return <FileCard media={content.media} fileName={content.fileName} />;
    case "story_reaction":
      return <StoryReactionContent emoji={content.emoji} own={own} />;
    case "audio":
      return null;
  }
}

function MessageBubbleComponent({ message, position, sender }: MessageBubbleProps) {
  const { t } = useTranslation();
  const actions = useMessageActionsContext();
  const own = message.senderId === actions.viewerId;
  const translation = useMessageTranslation(message, originalOf(message), actions.viewerId);
  const { displayMode } = useTranslationPreferences();
  const showingTranslation = translation.display?.showing === "translation";
  const isMedia = message.content.type === "image" || message.content.type === "video";
  const mediaOnly = isMedia && "caption" in message.content && message.content.caption === null;
  const failed = message.deliveryStatus === "failed";
  const endOfGroup = position === "last" || position === "single";

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        "group flex items-end gap-2 px-4 md:px-6",
        own ? "justify-end" : "justify-start",
        endOfGroup ? "pb-2" : "pb-0.5",
      )}
    >
      {sender && !own && (
        <span className="w-7 shrink-0">{endOfGroup && <UserAvatar user={sender} size="xs" />}</span>
      )}
      <div
        className={cn(
          "flex max-w-[85%] flex-col md:max-w-[min(75%,560px)]",
          own ? "items-end" : "items-start",
        )}
      >
        <MessageActions message={message} own={own} translation={translation}>
          <div
            className={cn(
              "relative rounded-2xl text-foreground shadow-sm",
              own ? "bg-bubble-out" : "bg-bubble-in",
              bubbleCorners(position, own),
              isMedia ? "p-1" : "px-3 py-1.5",
              failed && "opacity-80",
            )}
          >
            {sender && !own && (position === "first" || position === "single") && (
              <span
                className={cn("block text-sm font-semibold text-primary", isMedia && "px-1.5 pb-1")}
              >
                {sender.displayName}
              </span>
            )}
            {message.replyTo && (
              <ReplyQuote
                reference={message.replyTo}
                senderName={
                  message.replyTo.senderId === actions.viewerId
                    ? t("common.you")
                    : actions.senderName(message.replyTo.senderId)
                }
              />
            )}
            <MessageContentView message={message} own={own} translation={translation} />
            <div className={cn(isMedia && "px-1.5")}>
              <ReactionChips
                reactions={message.reactions}
                onToggle={(emoji) => actions.react(message, emoji)}
              />
              {message.reactions.length > 0 && <span aria-hidden className="block h-4" />}
            </div>
            <BubbleMeta
              message={message}
              own={own}
              overlay={mediaOnly && message.reactions.length === 0}
              translated={showingTranslation}
              alwaysShowTranslatedIcon={displayMode === "both"}
            />
          </div>
        </MessageActions>
        {failed && message.clientId && (
          <div className="mt-1 flex items-center gap-3 text-xs" role="alert">
            <span className="text-destructive">{t("chat.message.failed")}</span>
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={() => message.clientId && actions.retry(message.clientId)}
            >
              {t("chat.message.retry")}
            </button>
            <button
              type="button"
              className="text-muted-foreground"
              onClick={() => message.clientId && actions.discard(message.clientId)}
            >
              {t("chat.message.discard")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Memoized: long lists get frequent cache patches (status, translations, reactions). */
export const MessageBubble = memo(MessageBubbleComponent);
