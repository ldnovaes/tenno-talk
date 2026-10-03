import { Copy, Forward, Reply, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Message } from "@/types/message";

import { originalOf } from "../../lib/messageText";
import { displayTextFor } from "../../lib/previewText";
import { useMessageActionsContext } from "./messageActionsContext";

export interface MessageActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/** One list of actions rendered by the context menu, the "⋯" menu and the mobile drawer. */
export function useMessageActionItems(message: Message): MessageActionItem[] {
  const { t } = useTranslation();
  const actions = useMessageActionsContext();
  const pending = message.deliveryStatus === "sending" || message.deliveryStatus === "failed";
  const shown = displayTextFor(message, actions.viewerId);
  const original = originalOf(message);
  const items: MessageActionItem[] = [];
  if (!pending) {
    items.push({
      key: "reply",
      label: t("chat.actions.reply"),
      icon: Reply,
      onSelect: () => actions.reply(message),
    });
  }
  if (shown) {
    items.push({
      key: "copy",
      label: t("chat.actions.copy"),
      icon: Copy,
      onSelect: () => actions.copy(shown),
    });
  }
  if (original && shown !== original.text) {
    items.push({
      key: "copy-original",
      label: t("chat.actions.copyOriginal"),
      icon: Copy,
      onSelect: () => actions.copy(original.text),
    });
  }
  if (!pending) {
    items.push({
      key: "forward",
      label: t("chat.actions.forward"),
      icon: Forward,
      onSelect: () => actions.forward(message),
    });
  }
  return items;
}
