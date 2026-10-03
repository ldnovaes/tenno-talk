import { Languages } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

/** Shows the core idea: one message, two languages. */
export function TranslationDemo() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const appear = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.4, ease: "easeOut" as const },
        };

  return (
    <figure className="rounded-2xl bg-chat-bg p-4" aria-label={t("auth.demoBubbleCaption")}>
      <div className="flex flex-col gap-2">
        <motion.p
          {...appear(0.2)}
          lang="pt-BR"
          className="max-w-[80%] self-end rounded-2xl rounded-ee-md bg-bubble-out px-3.5 py-2 text-[15px]"
        >
          {t("auth.demoBubbleOriginal")}
        </motion.p>
        <motion.span
          {...appear(0.7)}
          className="flex items-center gap-1.5 self-center text-xs text-muted-foreground"
          aria-hidden
        >
          <Languages className="size-3.5" />
        </motion.span>
        <motion.p
          {...appear(1.1)}
          lang="vi-VN"
          className="max-w-[80%] self-start rounded-2xl rounded-es-md bg-bubble-in px-3.5 py-2 text-[15px] shadow-sm"
        >
          {t("auth.demoBubbleTranslated")}
        </motion.p>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        {t("auth.demoBubbleCaption")}
      </figcaption>
    </figure>
  );
}
