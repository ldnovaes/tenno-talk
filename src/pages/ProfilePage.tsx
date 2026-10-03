import { ImagePlus, MoreHorizontal, Settings, UserX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { OverlayLink } from "@/app/router/OverlayLink";
import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { useStartConversation } from "@/features/chat/hooks/useMessageMutations";
import { PostsGrid } from "@/features/feed/components/PostsGrid";
import { BlockUserDialog } from "@/features/profile/components/BlockUserDialog";
import { ProfileHeader } from "@/features/profile/components/ProfileHeader";
import { ProfileSkeleton } from "@/features/profile/components/ProfileSkeleton";
import { ProfileTabs } from "@/features/profile/components/ProfileTabs";
import { useBlockUser, useProfile } from "@/features/profile/hooks/useProfile";
import { usePanel } from "@/layouts/panelContext";
import { toAppError } from "@/lib/errors";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { username = "" } = useParams();
  const me = useCurrentUser();
  const panel = usePanel();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();
  const profile = useProfile(username);
  const start = useStartConversation();
  const block = useBlockUser();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const isOwn = profile.data?.id === me.id;

  const onBack = panel ? panel.close : isOwn ? undefined : () => navigate(-1);
  const actions = profile.data ? (
    isOwn ? (
      <Button asChild variant="ghost" size="icon">
        <OverlayLink to={paths.settings()} aria-label={t("nav.settings")}>
          <Settings className="size-5" />
        </OverlayLink>
      </Button>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("profile.menu")}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive" onSelect={() => setConfirmBlock(true)}>
            <UserX className="size-4" aria-hidden />
            {t("profile.block", { name: profile.data.displayName })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
            onMessage={() => {
              panel?.close();
              start.mutate(profile.data.id);
            }}
          />
          <ProfileTabs
            posts={
              <PostsGrid
                userId={profile.data.id}
                empty={
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
                }
              />
            }
          />
          <BlockUserDialog
            name={profile.data.displayName}
            open={confirmBlock}
            onOpenChange={setConfirmBlock}
            onConfirm={() => {
              block.mutate({ userId: profile.data.id, name: profile.data.displayName });
              if (panel) panel.close();
              else navigate(paths.chats());
            }}
          />
        </>
      )}
    </div>
  );
}
