import { useTranslation } from "react-i18next";

import type { MessageReference } from "@/types/message";

import { scrollToMessage } from "../../lib/scrollToMessage";

export function ReplyQuote({
  reference,
  senderName,
}: {
  reference: MessageReference;
  senderName: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => scrollToMessage(reference.messageId)}
      aria-label={t("chat.message.replyTo", { name: senderName })}
      className="mb-1 block w-full rounded-md border-s-[3px] border-primary bg-primary/10 px-2 py-1 text-start text-sm"
    >
      <span className="block truncate font-semibold text-primary">{senderName}</span>
      <span className="block truncate opacity-80" dir="auto">
        {reference.preview}
      </span>
    </button>
  );
}
