import { Reply, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MessageReference } from "@/types/message";

export function ReplyPreviewBar({
  reference,
  senderName,
  onCancel,
}: {
  reference: MessageReference;
  senderName: string;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-2 pb-2">
      <Reply className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 border-s-2 border-primary ps-2">
        <p className="truncate text-sm font-semibold text-primary">
          {t("chat.composer.replyingTo", { name: senderName })}
        </p>
        <p
          className="truncate text-sm text-muted-foreground"
          dir="auto"
          lang={reference.language ?? undefined}
        >
          {reference.preview}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={t("chat.composer.cancelReply")}
        className="grid size-8 place-items-center rounded-full hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
