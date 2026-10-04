import { useBack } from "@/app/router/useBack";
import { Flag, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReportItem } from "@/features/admin/components/ReportItem";
import { useReports, useResolveReport } from "@/features/admin/hooks/useReports";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { ContentColumn } from "@/layouts/ContentColumn";
import type { ReportStatus } from "@/types/moderation";

const STATUSES: ReportStatus[] = ["open", "reviewed", "dismissed"];

function ReportsPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ReportStatus>("open");
  const reports = useReports(status);
  const resolve = useResolveReport();
  return (
    <div className="space-y-3 p-4">
      <ToggleGroup
        type="single"
        value={status}
        onValueChange={(next) => next && setStatus(next as ReportStatus)}
        aria-label={t("admin.reports.title")}
        className="justify-start gap-1.5"
      >
        {STATUSES.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            className="h-8 rounded-full border-0 bg-muted px-3.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {t(`admin.reports.statuses.${option}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {reports.isPending && <Skeleton className="h-28 rounded-2xl" />}
      {reports.isError && <ErrorState onRetry={() => void reports.refetch()} />}
      {reports.data?.length === 0 && <EmptyState icon={Flag} title={t("admin.reports.empty")} />}
      {reports.data?.map((report) => (
        <ReportItem
          key={report.id}
          report={report}
          busy={resolve.isPending}
          onResolve={(next) => resolve.mutate({ id: report.id, status: next })}
        />
      ))}
    </div>
  );
}

export default function AdminReportsPage() {
  const { t } = useTranslation();
  const backSafe = useBack();
  const me = useCurrentUser();
  return (
    <ContentColumn>
      <PageHeader title={t("admin.reports.title")} onBack={backSafe} />
      {me.role === "admin" ? (
        <ReportsPanel />
      ) : (
        <EmptyState icon={ShieldAlert} title={t("admin.notAllowed")} />
      )}
    </ContentColumn>
  );
}
