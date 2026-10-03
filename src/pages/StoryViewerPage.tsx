import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { useCloseOverlay } from "@/app/router/overlay";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { StoryViewer } from "@/features/stories/components/StoryViewer";
import { useStoryTray } from "@/features/stories/hooks/useStories";
import type { StoryTrayItem } from "@/types/story";

export default function StoryViewerPage() {
  const { t } = useTranslation();
  const { userId = "" } = useParams();
  const me = useCurrentUser();
  const tray = useStoryTray();
  const close = useCloseOverlay();
  // Freeze the order while watching: a background refetch must not move the cursor.
  const [snapshot, setSnapshot] = useState<StoryTrayItem[] | null>(null);
  if (snapshot === null && tray.data) setSnapshot(tray.data);

  if (tray.isPending) return <div className="fixed inset-0 z-50 bg-black" aria-busy="true" />;
  if (!snapshot?.some((item) => item.user.id === userId)) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black p-6 text-center text-white">
        <div className="space-y-4">
          <p>{t("stories.unavailable")}</p>
          <button type="button" onClick={close} className="font-semibold underline">
            {t("stories.close")}
          </button>
        </div>
      </div>
    );
  }
  return <StoryViewer tray={snapshot} userId={userId} viewerId={me.id} onClose={close} />;
}
