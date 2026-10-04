import { useTranslation } from "react-i18next";

import { RelativeTime } from "@/components/common/RelativeTime";
import { Button } from "@/components/ui/button";
import type { Report } from "@/types/moderation";

interface ReportItemProps {
  report: Report;
  busy: boolean;
  onResolve: (status: "reviewed" | "dismissed") => void;
}

export function ReportItem({ report, busy, onResolve }: ReportItemProps) {
  const { t } = useTranslation();
  return (
    <article className="space-y-2 rounded-2xl border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{t(`moderation.reasons.${report.reason}`)}</h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.reports.by", { username: report.reporterUsername })} ·{" "}
            <RelativeTime iso={report.createdAt} />
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {t(`admin.reports.statuses.${report.status}`)}
        </span>
      </header>
      <p className="break-all font-mono text-xs text-muted-foreground" dir="ltr">
        {t("admin.reports.target", { kind: report.targetKind, id: report.targetId })}
      </p>
      {report.status === "open" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onResolve("reviewed")} disabled={busy}>
            {t("admin.reports.reviewed")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResolve("dismissed")}
            disabled={busy}
          >
            {t("admin.reports.dismiss")}
          </Button>
        </div>
      )}
    </article>
  );
}
