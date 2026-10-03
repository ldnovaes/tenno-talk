import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";

import { QUICK_REACTIONS } from "../message/bubbleStyles";

/** Menu item component (DropdownMenuItem / ContextMenuItem): picking closes the menu. */
type MenuItemComponent = ComponentType<{
  asChild?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}>;

export function QuickReactions({
  message,
  onReact,
  className,
  item: Item,
}: {
  message: Message;
  onReact: (emoji: string) => void;
  className?: string;
  item?: MenuItemComponent;
}) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t("chat.actions.react")} className={cn("flex gap-1", className)}>
      {QUICK_REACTIONS.map((emoji) => {
        const mine = message.reactions.some((r) => r.emoji === emoji && r.reactedByMe);
        const button = (
          <button
            key={emoji}
            type="button"
            aria-pressed={mine}
            aria-label={`${t("chat.actions.react")} ${emoji}`}
            onClick={Item ? undefined : () => onReact(emoji)}
            className={cn(
              "grid size-9 place-items-center rounded-full p-0 text-xl transition-transform hover:scale-110 focus:bg-accent active:scale-95",
              mine && "bg-accent",
            )}
          >
            {emoji}
          </button>
        );
        return Item ? (
          <Item key={emoji} asChild onSelect={() => onReact(emoji)}>
            {button}
          </Item>
        ) : (
          button
        );
      })}
    </div>
  );
}
