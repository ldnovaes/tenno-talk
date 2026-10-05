import { useTranslation } from "react-i18next";

import { UserAvatar } from "@/components/common/UserAvatar";
import { Button } from "@/components/ui/button";
import { useBlockedUsers, useUnblockUser } from "@/features/profile/hooks/useProfile";

export function BlockedUsers() {
  const { t } = useTranslation();
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();
  if (blocked.data?.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {t("settings.privacySection.noBlocked")}
      </p>
    );
  }
  return (
    <ul>
      {blocked.data?.map((profile) => (
        <li key={profile.id} className="flex items-center gap-3 px-4 py-2">
          <UserAvatar user={profile} size="sm" />
          <span className="min-w-0 flex-1 truncate font-medium">{profile.displayName}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => unblock.mutate({ userId: profile.id, name: profile.displayName })}
          >
            {t("settings.privacySection.unblock")}
          </Button>
        </li>
      ))}
    </ul>
  );
}
