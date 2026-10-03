import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useRealtimeStatus } from "../../hooks/useRealtimeStatus";

/** Like Telegram: the title turns into "Connecting…" while the live connection is down. */
export function ChatsTitle() {
  const { t } = useTranslation();
  const reconnecting = useRealtimeStatus() === "reconnecting";
  return (
    <h1 className="text-[22px] font-bold">
      {reconnecting ? (
        <span role="status" className="flex items-center gap-2 text-lg text-muted-foreground">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {t("chat.connecting")}
        </span>
      ) : (
        t("chat.title")
      )}
    </h1>
  );
}
