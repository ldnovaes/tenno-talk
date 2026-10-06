import { useTranslation } from "react-i18next";

import { StoryReplyLabel } from "./StoryReplyLabel";

/** A story reaction in the chat (PLAN.md §9.9): who reacted, and the emoji, big. */
export function StoryReactionContent({ emoji, own }: { emoji: string; own: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <StoryReplyLabel label={own ? t("stories.youReactedLabel") : t("stories.reactedLabel")} />
      <span dir="auto" className="block px-1 text-4xl leading-tight">
        {emoji}
      </span>
    </>
  );
}
