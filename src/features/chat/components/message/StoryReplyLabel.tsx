import { CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";

/** The story a message answers or reacts to; "Replied to a story" by default. */
export function StoryReplyLabel({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <span className="mb-1 flex items-center gap-1.5 border-s-[3px] border-primary ps-2 text-xs font-medium text-primary">
      <CircleDashed className="size-3.5" aria-hidden />
      {label ?? t("stories.repliedLabel")}
    </span>
  );
}
