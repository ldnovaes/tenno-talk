import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/user";

import { useFollowToggle } from "../hooks/useFollowToggle";

export function FollowButton({
  profile,
  size = "sm",
  className,
}: {
  profile: Pick<UserProfile, "id" | "isFollowing" | "displayName">;
  size?: "sm" | "default";
  className?: string;
}) {
  const { t } = useTranslation();
  const toggle = useFollowToggle();
  return (
    <Button
      size={size}
      variant={profile.isFollowing ? "secondary" : "default"}
      className={className}
      aria-pressed={profile.isFollowing}
      onClick={() => toggle.mutate({ userId: profile.id, follow: !profile.isFollowing })}
    >
      {profile.isFollowing ? t("onboarding.discover.following") : t("onboarding.discover.follow")}
    </Button>
  );
}
