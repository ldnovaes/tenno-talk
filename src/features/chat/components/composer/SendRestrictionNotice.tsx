import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useUnblockUser } from "@/features/profile/hooks/useProfile";
import type { SendRestriction } from "@/types/conversation";
import type { User } from "@/types/user";

/** In place of the composer: why this conversation can't send right now (PLAN.md §31.1). */
export function SendRestrictionNotice({
  restriction,
  other,
}: {
  restriction: SendRestriction;
  other: User | undefined;
}) {
  const { t } = useTranslation();
  const unblock = useUnblockUser();
  const name = other?.displayName ?? "";
  return (
    <div
      role="status"
      className="flex shrink-0 flex-col items-center gap-2 border-t bg-background px-4 pb-safe pt-3 text-center text-sm text-muted-foreground md:px-6"
    >
      <p>{t(`chat.composer.restriction.${restriction}`, { name })}</p>
      {restriction === "you_blocked" && other && (
        <Button
          size="sm"
          variant="secondary"
          disabled={unblock.isPending}
          onClick={() => unblock.mutate({ userId: other.id, name })}
        >
          {t("profile.unblockAction")}
        </Button>
      )}
    </div>
  );
}
