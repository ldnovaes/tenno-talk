import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Conversation } from "@/types/conversation";

import { presenceLabel } from "../../lib/presenceLabel";

interface PresenceSubtitleProps {
  conversation: Conversation;
  presence: { isOnline: boolean; lastSeenAt: string | null };
  typingUserIds: string[];
}

export function PresenceSubtitle({ conversation, presence, typingUserIds }: PresenceSubtitleProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  let text: string;
  let highlight = false;
  if (typingUserIds.length > 0) {
    highlight = true;
    const typer = conversation.members.find((member) => member.user.id === typingUserIds[0]);
    text =
      conversation.kind === "group" && typer
        ? t("chat.header.typingName", { name: typer.user.displayName })
        : t("chat.header.typing");
  } else if (conversation.kind === "group") {
    text = t("chat.header.members", { count: conversation.members.length });
  } else {
    const label = presenceLabel(presence, now);
    highlight = label.kind === "online";
    switch (label.kind) {
      case "online":
        text = t("chat.header.online");
        break;
      case "justNow":
        text = t("chat.header.lastSeenJustNow");
        break;
      case "minutes":
        text = t("chat.header.lastSeenMinutes", { count: label.count });
        break;
      case "hours":
        text = t("chat.header.lastSeenHours", { count: label.count });
        break;
      case "date":
        text = t("chat.header.lastSeenDate", { date: label.date });
        break;
      case "unknown":
        text = "";
    }
  }

  return (
    <span
      aria-live="polite"
      className={
        highlight
          ? "block truncate text-xs text-primary"
          : "block truncate text-xs text-muted-foreground"
      }
    >
      {text}
    </span>
  );
}
