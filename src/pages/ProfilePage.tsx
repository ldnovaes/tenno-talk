import { useBack } from "@/app/router/useBack";
import { ImagePlus, LockKeyhole, Settings, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { OverlayLink } from "@/app/router/OverlayLink";
import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useStartConversation } from "@/features/chat/hooks/useMessageMutations";
import { PostsGrid } from "@/features/feed/components/PostsGrid";
import { BlockedProfileNotice } from "@/features/profile/components/BlockedProfileNotice";
import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileMenu } from "@/features/profile/components/ProfileMenu";
import { ProfileSkeleton } from "@/features/profile/components/ProfileSkeleton";
import { ProfileTabs } from "@/features/profile/components/ProfileTabs";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { usePanel } from "@/layouts/panelContext";
import { toAppError } from "@/lib/errors";

export default function ProfilePage() {
  const { t } = useTranslation();
  const backSafe = useBack();
  const { username = "" } = useParams();
  const me = useCurrentUser();
  const panel = usePanel();
  const overlayNavigate = useOverlayNavigate();
  const profile = useProfile(username);
  const start = useStartConversation();
  const isOwn = profile.data?.id === me.id;

  const onBack = panel ? panel.close : isOwn ? undefined : backSafe;
  const actions = profile.data ? (
    isOwn ? (
      <Button asChild variant="ghost" size="icon">
        <OverlayLink to={paths.settings()} aria-label={t("nav.settings")}>
          <Settings className="size-5" />
        </OverlayLink>
      </Button>
    ) : (
      <ProfileMenu profile={profile.data} />
    )
  ) : null;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={profile.data ? `@${profile.data.username}` : ""}
        onBack={onBack}
        actions={actions}
      />
      {profile.isPending && <ProfileSkeleton />}
      {profile.isError &&
        (toAppError(profile.error).code === "not_found" ? (
          <EmptyState
            icon={UserX}
            title={t("profile.notFoundTitle")}
            description={t("profile.notFoundDescription")}
          />
        ) : (
          <ErrorState onRetry={() => void profile.refetch()} />
        ))}
      {profile.data && (
        <>
          <ProfileHeader
            profile={profile.data}
            isOwn={isOwn}
            onEdit={() => overlayNavigate(paths.editProfile(me.username))}
            // Opening the chat leaves the side panel by itself; a refusal keeps the profile on screen.
            onMessage={() => start.mutate(profile.data.id)}
          />
          {profile.data.blockStatus !== "none" ? (
            <BlockedProfileNotice profile={profile.data} />
          ) : (
            <ProfileTabs
              posts={
                <PostsGrid
                  userId={profile.data.id}
                  empty={
                    profile.data.isPrivate && !isOwn && !profile.data.isFollowing ? (
                      <EmptyState
                        icon={LockKeyhole}
                        title={t("profile.privateTitle")}
                        description={t("profile.privateDescription")}
                      />
                    ) : (
                      <EmptyState
                        icon={ImagePlus}
                        title={t("profile.emptyPosts")}
                        description={isOwn ? t("profile.emptyPostsOwn") : undefined}
                        action={
                          isOwn ? (
                            <Button asChild size="sm">
                              <OverlayLink to={paths.create()}>{t("nav.create")}</OverlayLink>
                            </Button>
                          ) : undefined
                        }
                      />
                    )
                  }
                />
              }
            />
          )}
        </>
      )}
    </div>
  );
}
