import { useTranslation } from "react-i18next";

import type { DayLabel } from "@/lib/dates";

export function DayDivider({ label }: { label: DayLabel }) {
  const { t } = useTranslation();
  const text =
    label.kind === "today"
      ? t("common.today")
      : label.kind === "yesterday"
        ? t("common.yesterday")
        : label.date;
  return (
    <div className="sticky top-2 z-[1] flex justify-center py-2" role="separator" aria-label={text}>
      <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
        {text}
      </span>
    </div>
  );
}
