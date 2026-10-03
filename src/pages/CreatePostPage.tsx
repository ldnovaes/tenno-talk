import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useBackgroundLocation, useCloseOverlay } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreatePostForm } from "@/features/feed/components/create/CreatePostForm";

/** Dialog over the current screen on md+, full page on mobile (PLAN.md §8). */
export default function CreatePostPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const close = useCloseOverlay();
  const done = () => navigate(paths.feed(), { replace: true });

  if (background) {
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{t("feed.createPost.title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("feed.createPost.pick")}</DialogDescription>
          </DialogHeader>
          <CreatePostForm onPublished={done} />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("feed.createPost.title")} onBack={() => navigate(-1)} />
      <CreatePostForm onPublished={done} />
    </div>
  );
}
