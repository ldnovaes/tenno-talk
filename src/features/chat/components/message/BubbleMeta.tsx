import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";

import { DeliveryTicks } from "./DeliveryTicks";

/** Time + ticks pinned to the bubble's bottom corner (Telegram-like). */
export function BubbleMeta({
  message,
  own,
  overlay = false,
}: {
  message: Message;
  own: boolean;
  overlay?: boolean;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-1 end-2 flex items-center gap-1 text-[11px] leading-none tabular-nums",
        own ? "text-bubble-meta-out" : "text-bubble-meta",
        overlay && "rounded-full bg-black/45 px-1.5 py-1 text-white",
      )}
    >
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
export function MetaSpacer({ own }: { own: boolean }) {
  return <span aria-hidden className={cn("inline-block h-3", own ? "w-[58px]" : "w-[38px]")} />;
}
