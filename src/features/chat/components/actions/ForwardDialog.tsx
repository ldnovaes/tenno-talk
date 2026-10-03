import { useState } from "react";
import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Message } from "@/types/message";

import { useConversations } from "../../hooks/useConversations";
import { useForwardMessage } from "../../hooks/useMessageMutations";
import { conversationAvatar, conversationTitle } from "../../lib/conversationFilters";

interface ForwardDialogProps {
  message: Message | null;
  viewerId: string;
  onClose: () => void;
}

export function ForwardDialog({ message, viewerId, onClose }: ForwardDialogProps) {
  const { t } = useTranslation();
  const conversations = useConversations();
  const forward = useForwardMessage();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );

  return (
    <Dialog
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelected([]);
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.forward.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("chat.forward.title")}</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto">
          {conversations.data?.map((conversation) => {
            const id = `forward-${conversation.id}`;
            const checked = selected.includes(conversation.id);
            return (
              <li key={conversation.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) => toggle(conversation.id, value === true)}
                  />
                  <UserAvatar user={conversationAvatar(conversation, viewerId)} size="sm" />
                  <span className="truncate font-medium">
                    {conversationTitle(conversation, viewerId)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button
            disabled={!message || selected.length === 0 || forward.isPending}
            onClick={() => {
              if (!message) return;
              forward.mutate(
                { messageId: message.id, conversationIds: selected },
                {
                  onSuccess: () => {
                    setSelected([]);
                    onClose();
                  },
                },
              );
            }}
          >
            {t("chat.forward.send", { count: Math.max(1, selected.length) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
