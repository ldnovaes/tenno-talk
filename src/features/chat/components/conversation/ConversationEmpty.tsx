import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import { getLanguage } from "@/lib/languages";
import type { ConversationMember } from "@/types/conversation";

/** First-contact state: makes the translation promise explicit once. */
export function ConversationEmpty({ other }: { other: ConversationMember | null }) {
  const { t } = useTranslation();
  if (!other) return null;
  const language = getLanguage(other.receivingLanguage)?.nativeName ?? other.receivingLanguage;
  return (
    <div className="m-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl bg-background/80 p-6 text-center shadow-sm">
      <UserAvatar user={other.user} size="lg" />
      <h2 className="font-semibold">
        {t("chat.empty.newConversationTitle", { name: other.user.displayName })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("chat.empty.newConversationDescription", { name: other.user.displayName, language })}
      </p>
    </div>
  );
}
