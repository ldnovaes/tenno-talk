import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLanguage } from "@/lib/languages";
import type { Conversation } from "@/types/conversation";

/** Members and the language each one receives the group in. */
export function GroupInfoDialog({
  conversation,
  viewerId,
  open,
  onOpenChange,
}: {
  conversation: Conversation;
  viewerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{conversation.title}</DialogTitle>
          <DialogDescription>
            {t("chat.header.members", { count: conversation.members.length })}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1">
          {conversation.members.map((member) => {
            const language = getLanguage(member.receivingLanguage);
            return (
              <li key={member.user.id} className="flex items-center gap-3 py-1.5">
                <UserAvatar user={member.user} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {member.user.id === viewerId ? t("groups.you") : member.user.displayName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {t("groups.receives", {
                      language: language?.nativeName ?? member.receivingLanguage,
                    })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
