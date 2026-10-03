import { MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { useLongPress } from "@/hooks/useLongPress";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/message";

import { useMessageActionsContext } from "./messageActionsContext";
import { QuickReactions } from "./QuickReactions";
import { useMessageActionItems } from "./useMessageActionItems";

/**
 * Desktop: right-click menu + "⋯" button on hover/focus.
 * Mobile: long-press opens a drawer. PLAN.md §9.4.
 */
export function MessageActions({
  message,
  own,
  children,
}: {
  message: Message;
  own: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const actions = useMessageActionsContext();
  const items = useMessageActionItems(message);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const longPress = useLongPress(() => setDrawerOpen(true));
  const react = (emoji: string) => actions.react(message, emoji);
  const canReact = message.deliveryStatus !== "sending" && message.deliveryStatus !== "failed";

  if (isMobile) {
    return (
      <>
        <div {...longPress} className="select-none [-webkit-touch-callout:none]">
          {children}
        </div>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader className="sr-only">
              <DrawerTitle>{t("chat.actions.menu")}</DrawerTitle>
              <DrawerDescription>{t("chat.actions.menu")}</DrawerDescription>
            </DrawerHeader>
            {canReact && (
              <QuickReactions
                message={message}
                onReact={(emoji) => {
                  react(emoji);
                  setDrawerOpen(false);
                }}
                className="justify-around px-4 pb-2 pt-3"
              />
            )}
            <ul className="pb-safe">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      item.onSelect();
                      setDrawerOpen(false);
                    }}
                    className="flex w-full items-center gap-4 px-6 py-3.5 text-start text-[15px] active:bg-muted"
                  >
                    <item.icon className="size-5 text-muted-foreground" aria-hidden />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", own ? "flex-row-reverse" : "flex-row")}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-w-0">{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-52">
          {canReact && (
            <QuickReactions
              message={message}
              onReact={react}
              item={ContextMenuItem}
              className="p-1"
            />
          )}
          {canReact && items.length > 0 && <ContextMenuSeparator />}
          {items.map((item) => (
            <ContextMenuItem key={item.key} onSelect={item.onSelect}>
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
      {(items.length > 0 || canReact) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("chat.actions.menu")}
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background/70 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={own ? "end" : "start"} className="min-w-52">
            {canReact && (
              <QuickReactions
                message={message}
                onReact={react}
                item={DropdownMenuItem}
                className="p-1"
              />
            )}
            {canReact && items.length > 0 && <DropdownMenuSeparator />}
            {items.map((item) => (
              <DropdownMenuItem key={item.key} onSelect={item.onSelect}>
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
