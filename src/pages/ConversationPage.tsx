import { MessageCircleOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { ConversationView } from "@/features/chat/components/conversation/ConversationView";
import { MessageListSkeleton } from "@/features/chat/components/conversation/MessageListSkeleton";
import { useConversation } from "@/features/chat/hooks/useConversations";
import { toAppError } from "@/lib/errors";

export default function ConversationPage() {
  const { t } = useTranslation();
  const { conversationId = "" } = useParams();
  const me = useCurrentUser();
  const conversation = useConversation(conversationId);

  if (conversation.isPending) return <MessageListSkeleton />;
  if (conversation.error) {
    const error = toAppError(conversation.error);
    if (error.code === "not_found" || error.code === "forbidden") {
      return (
        <div className="grid h-full place-items-center">
          <EmptyState
            icon={MessageCircleOff}
            title={t("errors.notFoundTitle")}
            description={error.message}
          />
        </div>
      );
    }
    return <ErrorState onRetry={() => void conversation.refetch()} className="h-full" />;
  }
  if (!conversation.data) return null;
  return (
    <ConversationView
      key={conversation.data.id}
      conversation={conversation.data}
      viewerId={me.id}
    />
  );
}
