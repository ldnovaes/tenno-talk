import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ScrollToBottomButton({ unseen, onClick }: { unseen: number; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        unseen > 0
          ? t("chat.message.newMessages", { count: unseen })
          : t("chat.message.scrollToBottom")
      }
      className="absolute bottom-3 end-3 grid size-11 place-items-center rounded-full bg-background text-muted-foreground shadow-md transition-transform active:scale-95"
    >
      <ChevronDown className="size-5" aria-hidden />
      {unseen > 0 && (
        <span className="absolute -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-unread px-1 text-[11px] font-bold text-primary-foreground">
          {unseen}
        </span>
      )}
    </button>
  );
}
