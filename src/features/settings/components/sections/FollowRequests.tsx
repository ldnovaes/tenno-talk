import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { useFollowRequestDecision } from "@/features/profile/hooks/useFollowRequestDecision";
import { profileService } from "@/services/profileService";

export function FollowRequests() {
  const { t } = useTranslation();
  const requests = useQuery({
    queryKey: profileKeys.followRequests(),
    queryFn: () => profileService.getFollowRequests(),
  });
  const decide = useFollowRequestDecision();
  if (requests.isPending)
    return <p className="px-4 py-3 text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (requests.isError)
    return <ErrorState className="py-4" onRetry={() => void requests.refetch()} />;
  if (!requests.data?.length)
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {t("settings.privacySection.noFollowRequests")}
      </p>
    );
  return (
    <div>
      {decide.isError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {t("errors.generic")}
        </p>
      )}
      <ul>
        {requests.data.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-3">
            <UserAvatar user={person} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium">{person.displayName}</span>
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ userId: person.id, approve: true })}
            >
              {t("settings.privacySection.approve")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ userId: person.id, approve: false })}
            >
              {t("settings.privacySection.decline")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
