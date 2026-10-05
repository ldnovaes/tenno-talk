import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useFollowRequestDecision } from "@/features/profile/hooks/useFollowRequestDecision";
import { useFollowToggle } from "@/features/profile/hooks/useFollowToggle";
import type { Notification } from "@/types/notification";

function FollowBack({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const follow = useFollowToggle();
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <Button
      size="sm"
      disabled={follow.isPending}
      onClick={() => follow.mutate({ userId, follow: true }, { onSuccess: () => setDone(true) })}
    >
      {t("notifications.followBack")}
    </Button>
  );
}

function FollowRequestDecision({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const decide = useFollowRequestDecision();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        disabled={decide.isPending}
        onClick={() => decide.mutate({ userId, approve: true })}
      >
        {t("notifications.confirmRequest")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={decide.isPending}
        onClick={() => decide.mutate({ userId, approve: false })}
      >
        {t("notifications.deleteRequest")}
      </Button>
    </div>
  );
}

/** The one action a notification may offer next to the row (the row itself opens the target). */
export function NotificationActions({ notification }: { notification: Notification }) {
  switch (notification.type) {
    case "follow":
      return <FollowBack userId={notification.actor.id} />;
    case "follow_request":
      return <FollowRequestDecision userId={notification.actor.id} />;
    default:
      return null;
  }
}
