import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/user";

import { useFollowToggle } from "../hooks/useFollowToggle";

export function FollowButton({
  profile,
  size = "sm",
  className,
}: {
  profile: Pick<
    UserProfile,
    "id" | "isFollowing" | "isPrivate" | "followRequestPending" | "displayName"
  >;
  size?: "sm" | "default";
  className?: string;
}) {
  const { t } = useTranslation();
  const toggle = useFollowToggle();
  return (
    <Button
      size={size}
      variant={profile.isFollowing || profile.followRequestPending ? "secondary" : "default"}
      className={className}
      aria-pressed={profile.isFollowing || profile.followRequestPending}
      onClick={() =>
        toggle.mutate({
          userId: profile.id,
          follow: !profile.isFollowing && !profile.followRequestPending,
        })
      }
    >
      {profile.isFollowing
        ? t("onboarding.discover.following")
        : profile.followRequestPending
          ? t("profile.requested")
          : t("onboarding.discover.follow")}
    </Button>
  );
}
