import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";

import { DeliveryTicks } from "./DeliveryTicks";

interface BubbleMetaProps {
  message: Message;
  own: boolean;
  overlay?: boolean;
  /** Showing a translation: a 12px icon, visible in "both" mode or on hover/focus only. */
  translated?: boolean;
  alwaysShowTranslatedIcon?: boolean;
}

/** Time + ticks pinned to the bubble's bottom corner (Telegram-like). */
export function BubbleMeta({
  message,
  own,
  overlay = false,
  translated = false,
  alwaysShowTranslatedIcon = false,
}: BubbleMetaProps) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-1 end-2 flex items-center gap-1 text-[11px] leading-none tabular-nums",
        own ? "text-bubble-meta-out" : "text-bubble-meta",
        overlay && "rounded-full bg-black/45 px-1.5 py-1 text-white",
      )}
    >
      {translated && (
        <Languages
          role="img"
          aria-label={t("translation.showTranslation")}
          className={cn(
            "size-3 transition-opacity",
            !alwaysShowTranslatedIcon &&
              "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        />
      )}
      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      {own && (
        <DeliveryTicks
          status={message.deliveryStatus}
          className={overlay ? "text-white" : undefined}
        />
      )}
    </span>
  );
}

/** Invisible spacer so the last text line never runs under the meta. */
export function MetaSpacer({ own, translated = false }: { own: boolean; translated?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-3", own ? "w-[58px]" : "w-[38px]", translated && "ms-4")}
    />
  );
}
