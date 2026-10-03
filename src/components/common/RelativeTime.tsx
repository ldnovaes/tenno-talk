import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatListTimestamp } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ISODateString } from "@/types/api";

/** Short timestamp that refreshes every minute; full date in the tooltip. */
export function RelativeTime({ iso, className }: { iso: ISODateString; className?: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString()}
      className={cn("tabular-nums", className)}
    >
      {formatListTimestamp(iso, now, { yesterday: t("common.yesterday") })}
    </time>
  );
}
