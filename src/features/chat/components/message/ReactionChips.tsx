import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { ReactionSummary } from "@/types/message";

export function ReactionChips({
  reactions,
  onToggle,
}: {
  reactions: ReactionSummary[];
  onToggle: (emoji: string) => void;
}) {
  const { t } = useTranslation();
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          aria-pressed={reaction.reactedByMe}
          aria-label={t("chat.message.reactionLabel", {
            emoji: reaction.emoji,
            count: reaction.count,
          })}
          onClick={() => onToggle(reaction.emoji)}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium transition-transform active:scale-95",
            reaction.reactedByMe ? "bg-primary text-primary-foreground" : "bg-foreground/10",
          )}
        >
          <span>{reaction.emoji}</span>
          {reaction.count > 1 && <span>{reaction.count}</span>}
        </button>
      ))}
    </div>
  );
}
