import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderCard } from "@/features/admin/components/ProviderCard";
import { QueueSummary } from "@/features/admin/components/QueueSummary";
import { ReauthChallengeCard } from "@/features/admin/components/ReauthChallengeCard";
import { useAiStatus, useCheckProvider, useStartReauth } from "@/features/admin/hooks/useAiAdmin";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { ContentColumn } from "@/layouts/ContentColumn";

function AiProvidersPanel() {
  const { t } = useTranslation();
  const status = useAiStatus();
  const check = useCheckProvider();
  const reauth = useStartReauth();
  const busy = check.isPending || reauth.isPending;

  if (status.isPending) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }
  if (status.isError) return <ErrorState onRetry={() => void status.refetch()} />;

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">{t("admin.ai.description")}</p>
      {reauth.data && <ReauthChallengeCard challenge={reauth.data} />}
      {status.data.providers.map((provider, position) => (
        <ProviderCard
          key={provider.provider}
          provider={provider}
          primary={position === 0}
          busy={busy}
          onCheck={() => check.mutate(provider.provider)}
          onReauth={() => reauth.mutate(provider.provider)}
        />
      ))}
      <QueueSummary queue={status.data.queue} />
    </div>
  );
}

export default function AdminAiPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useCurrentUser();
  return (
    <ContentColumn>
      <PageHeader title={t("admin.ai.title")} onBack={() => navigate(-1)} />
      {me.role === "admin" ? (
        <AiProvidersPanel />
      ) : (
        <EmptyState icon={ShieldAlert} title={t("admin.notAllowed")} />
      )}
    </ContentColumn>
  );
}
