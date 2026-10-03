import { CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StoryReplyLabel() {
  const { t } = useTranslation();
  return (
    <span className="mb-1 flex items-center gap-1.5 border-s-[3px] border-primary ps-2 text-xs font-medium text-primary">
      <CircleDashed className="size-3.5" aria-hidden />
      {t("stories.repliedLabel")}
    </span>
  );
}
