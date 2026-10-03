import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { ContentTranslationState } from "../hooks/useContentTranslation";

/** Caption/comment text with a discreet "See translation / See original" toggle. */
export function TranslatedContent({
  state,
  prefix,
  className,
}: {
  state: ContentTranslationState;
  prefix?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <p className={cn("whitespace-pre-wrap break-words", state.isTranslating && "text-shimmer")}>
        {prefix}
        <span lang={state.language} dir="auto">
          {state.text}
        </span>
      </p>
      {state.translatable && (
        <button
          type="button"
          onClick={state.showingTranslation ? state.seeOriginal : state.seeTranslation}
          className="mt-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {state.showingTranslation
            ? t("translation.seeOriginal")
            : t("translation.seeTranslation")}
        </button>
      )}
    </div>
  );
}
