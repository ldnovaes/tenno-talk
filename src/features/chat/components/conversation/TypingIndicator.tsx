import { useTranslation } from "react-i18next";

export function TypingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex px-3 py-1" aria-label={t("chat.header.typing")} role="status">
      <span className="flex items-center gap-1 rounded-2xl rounded-es-md bg-bubble-in px-3.5 py-3 shadow-sm">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            aria-hidden
            className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  );
}
