import { Copy, Forward, GraduationCap, Languages, Reply, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MessageTranslationState } from "@/features/translation/hooks/useMessageTranslation";
import { useTranslationPreferences } from "@/features/translation/hooks/useTranslationPreferences";
import type { Message } from "@/types/message";

import { originalOf } from "../../lib/messageText";
import { useMessageActionsContext } from "./messageActionsContext";

export interface MessageActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/** One list of actions rendered by the context menu, the "⋯" menu and the mobile drawer. */
export function useMessageActionItems(
  message: Message,
  translation: MessageTranslationState,
): MessageActionItem[] {
  const { t } = useTranslation();
  const actions = useMessageActionsContext();
  const { learningMode } = useTranslationPreferences();
  const pending = message.deliveryStatus === "sending" || message.deliveryStatus === "failed";
  const own = message.senderId === actions.viewerId;
  const display = translation.display;
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
  if (display?.canToggle) {
    items.push(
      display.showing === "translation"
        ? {
            key: "show-original",
            label: t("translation.showOriginal"),
            icon: Languages,
            onSelect: translation.showOriginal,
          }
        : {
            key: "show-translation",
            label: t("translation.showTranslation"),
            icon: Languages,
            onSelect: translation.showTranslation,
          },
    );
  }
  if (learningMode && !own && message.translation?.status === "translated") {
    items.push({
      key: "learn",
      label: t("translation.learn"),
      icon: GraduationCap,
      onSelect: () => actions.learn(message),
    });
  }
  if (display) {
    const shown = display.primary.text;
    items.push({
      key: "copy",
      label: t("chat.actions.copy"),
      icon: Copy,
      onSelect: () => actions.copy(shown),
    });
    if (original && display.primary.kind === "translation") {
      items.push({
        key: "copy-original",
        label: t("chat.actions.copyOriginal"),
        icon: Copy,
        onSelect: () => actions.copy(original.text),
      });
    }
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
