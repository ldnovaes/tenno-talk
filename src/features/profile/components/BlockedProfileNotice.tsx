import { UserX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/user";

import { useUnblockUser } from "../hooks/useProfile";

/** In place of posts when there is a block (PLAN.md §31.1): Unblock for the blocker, a plain notice otherwise. */
export function BlockedProfileNotice({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const unblock = useUnblockUser();
  if (profile.blockStatus === "blocked_me") {
    return (
      <EmptyState
        icon={UserX}
        title={t("profile.unavailableTitle")}
        description={t("profile.unavailableDescription")}
      />
    );
  }
  return (
    <EmptyState
      icon={UserX}
      title={t("profile.youBlockedTitle", { name: profile.displayName })}
      description={t("profile.youBlockedDescription")}
      action={
        <Button
          size="sm"
          disabled={unblock.isPending}
          onClick={() => unblock.mutate({ userId: profile.id, name: profile.displayName })}
        >
          {t("profile.unblockAction")}
        </Button>
      }
    />
  );
}
