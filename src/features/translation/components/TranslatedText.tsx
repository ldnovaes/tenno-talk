import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { getLanguageDir } from "@/lib/languages";
import { cn } from "@/lib/utils";

import type { MessageTranslationState } from "../hooks/useMessageTranslation";
import { TranslationHint } from "./TranslationHint";

interface TranslatedTextProps {
  state: MessageTranslationState;
  since: string;
  /** Rendered at the end of the last line (keeps the time/ticks from overlapping). */
  trailing?: ReactNode;
}

/**
 * Message text with its translation, in ONE bubble (PLAN.md §14.5). The original
 * is secondary in "Original + Translation"; switching crossfades in place.
 */
export function TranslatedText({ state, since, trailing }: TranslatedTextProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  if (!state.display) return null;
  const { primary, secondary, hint } = state.display;

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${primary.kind}:${primary.text}`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.15 }}
          lang={primary.language}
          dir={getLanguageDir(primary.language) === "rtl" ? "rtl" : "auto"}
          className={cn(
            "whitespace-pre-wrap break-words text-[15px] leading-[1.4]",
            hint === "translating" && "text-shimmer",
          )}
        >
          {primary.text}
          {!secondary && trailing}
        </motion.p>
      </AnimatePresence>
      {secondary && (
        <div className="mt-1.5 border-t border-foreground/10 pt-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide opacity-60">
            {t("translation.original")}
          </span>
          <p
            lang={secondary.language}
            dir="auto"
            className="whitespace-pre-wrap break-words text-sm leading-snug opacity-75"
          >
            {secondary.text}
            {trailing}
          </p>
        </div>
      )}
      {hint && (
        <TranslationHint
          hint={hint}
          since={since}
          onRetry={state.retry}
          retrying={state.isRetrying}
        />
      )}
    </div>
  );
}
