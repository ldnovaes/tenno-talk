import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Conversation } from "@/types/conversation";
import type { Message } from "@/types/message";

import { useReactToMessage } from "../../hooks/useMessageMutations";
import { useSendMessage } from "../../hooks/useSendMessage";
import { displayTextFor } from "../../lib/previewText";
import { useComposerStore } from "../../stores/composerStore";
import { ForwardDialog } from "../actions/ForwardDialog";
import { MessageActionsContext, type MessageActionsValue } from "../actions/messageActionsContext";
import { Composer } from "../composer/Composer";
import { ConversationHeader } from "./ConversationHeader";
import { MessageList } from "./MessageList";

export function ConversationView({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  const { t } = useTranslation();
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const setReplyTo = useComposerStore((state) => state.setReplyTo);
  const react = useReactToMessage();
  const { retry, discard } = useSendMessage(conversation.id);

  const senderName = useCallback(
    (senderId: string) =>
      conversation.members.find((m) => m.user.id === senderId)?.user.displayName ?? "",
    [conversation.members],
  );

  const actions = useMemo<MessageActionsValue>(
    () => ({
      viewerId,
      senderName,
      reply: (message) =>
        setReplyTo(conversation.id, {
          messageId: message.id,
          senderId: message.senderId,
          preview: displayTextFor(message, viewerId) ?? t("chat.preview.photo"),
        }),
      forward: setForwarding,
      react: (message, emoji) => react.mutate({ message, emoji }),
      copy: (text) =>
        void navigator.clipboard
          ?.writeText(text)
          .then(() => toast.success(t("chat.actions.copied")))
          .catch(() => toast.error(t("errors.generic"))),
      retry,
      discard,
    }),
    // react.mutate is stable; keep the context stable so memoized bubbles don't re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewerId, senderName, conversation.id, setReplyTo, retry, discard, t],
  );

  return (
    <MessageActionsContext.Provider value={actions}>
      <div className="flex h-full min-h-0 flex-col bg-chat-bg">
        <ConversationHeader conversation={conversation} viewerId={viewerId} />
        <MessageList conversation={conversation} viewerId={viewerId} />
        <Composer
          key={conversation.id}
          conversationId={conversation.id}
          senderName={senderName}
          viewerId={viewerId}
        />
      </div>
      <ForwardDialog message={forwarding} viewerId={viewerId} onClose={() => setForwarding(null)} />
    </MessageActionsContext.Provider>
  );
}
