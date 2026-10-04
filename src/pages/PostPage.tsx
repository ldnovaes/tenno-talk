import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "react-router";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { readBackground, useCloseOverlay } from "@/app/router/overlay";
import { useBack } from "@/app/router/useBack";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentsBody } from "@/features/feed/components/CommentsBody";
import { PostCard } from "@/features/feed/components/PostCard";
import { usePost } from "@/features/feed/hooks/useFeed";
import { useIsMobile } from "@/hooks/useBreakpoint";

export default function PostPage() {
  const { postId = "" } = useParams();
  const location = useLocation();
  const post = usePost(postId);
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const closeOverlay = useCloseOverlay();
  const back = useBack("/feed");
  const focus = () => document.getElementById(`comment-${postId}`)?.focus();
  const body = (
    <>
      {post.isPending && <Skeleton className="m-4 h-64" />}
      {post.isError && <ErrorState onRetry={() => void post.refetch()} />}
      {post.data && (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="max-h-[35dvh] overflow-y-auto border-b md:max-h-none md:w-1/2 md:border-e md:border-b-0">
            <PostCard post={post.data} onOpenComments={focus} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <CommentsBody post={post.data} />
          </div>
        </div>
      )}
    </>
  );
  if (mobile && readBackground(location.state))
    return (
      <Drawer open onOpenChange={(open) => !open && back()}>
        <DrawerContent className="h-[90dvh] max-h-[90dvh] overflow-hidden">
          <DrawerTitle className="sr-only">{t("feed.commentsTitle")}</DrawerTitle>
          <DrawerDescription className="sr-only">{t("feed.openPost")}</DrawerDescription>
          <PageHeader title={t("feed.commentsTitle")} onBack={back} />
          {body}
        </DrawerContent>
      </Drawer>
    );
  if (mobile)
    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <PageHeader title={t("feed.commentsTitle")} onBack={back} />
        {body}
      </div>
    );
  return (
    <Dialog open onOpenChange={(open) => !open && closeOverlay()}>
      <DialogContent className="flex h-[85dvh] max-h-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogTitle className="border-b px-6 py-4">{t("feed.commentsTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("feed.openPost")}</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}
