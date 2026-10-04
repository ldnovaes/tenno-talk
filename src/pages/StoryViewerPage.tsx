import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router";

import { useCloseOverlay } from "@/app/router/overlay";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { StoryViewer } from "@/features/stories/components/StoryViewer";
import { useStoryTray, useUserStories } from "@/features/stories/hooks/useStories";
import type { StoryTrayItem } from "@/types/story";

export default function StoryViewerPage() {
  const { t } = useTranslation();
  const { userId = "" } = useParams();
  const [params] = useSearchParams();
  const me = useCurrentUser();
  const tray = useStoryTray();
  const userStories = useUserStories(userId);
  const close = useCloseOverlay();
  const [snapshot, setSnapshot] = useState<StoryTrayItem[] | null>(null);
  const first = userStories.data?.[0];
  if (snapshot === null && first) {
    const items = tray.data ?? [];
    const ownItem = { user: first.author, stories: userStories.data ?? [], hasUnseen: true };
    setSnapshot(
      items.some((item) => item.user.id === userId)
        ? items.map((item) => (item.user.id === userId ? ownItem : item))
        : [ownItem],
    );
  }

  const target = params.get("storyId");
  const missingTarget = target && !userStories.data?.some((story) => story.id === target);
  if (userStories.isPending || userStories.isError || !first || !snapshot || missingTarget) {
    return (
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-background p-6 text-center"
        aria-busy={userStories.isPending}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("stories.close")}
          className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 shrink-0 place-items-center rounded-full bg-muted"
        >
          <X className="size-6" />
        </button>
        {!userStories.isPending && <p>{t("stories.unavailable")}</p>}
      </div>
    );
  }
  return (
    <StoryViewer
      key={userId}
      tray={snapshot}
      userId={userId}
      viewerId={me.id}
      onClose={close}
      storyId={params.get("storyId")}
    />
  );
}
