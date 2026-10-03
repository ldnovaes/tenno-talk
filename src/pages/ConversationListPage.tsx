import { ConversationListPane } from "@/features/chat/components/conversation-list/ConversationListPane";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { StoriesTray } from "@/features/stories/components/StoriesTray";

export default function ConversationListPage() {
  const me = useCurrentUser();
  return <ConversationListPane header={<StoriesTray me={me} />} />;
}
