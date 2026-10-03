import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OverlayLink } from "@/app/router/OverlayLink";
import { paths } from "@/app/router/paths";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/types/user";

import { useStoryTray } from "../hooks/useStories";
import { CreateStoryDialog } from "./CreateStoryDialog";

/** Horizontal tray at the top of Chats and Feed (PLAN.md §9.9). */
export function StoriesTray({ me }: { me: User }) {
  const { t } = useTranslation();
  const tray = useStoryTray();
  const [creating, setCreating] = useState(false);
  const own = tray.data?.find((item) => item.user.id === me.id);
  const others = tray.data?.filter((item) => item.user.id !== me.id) ?? [];

  return (
    <section aria-label={t("stories.tray")} className="shrink-0">
      <ul className="flex gap-3 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none]">
        <li className="flex w-16 shrink-0 flex-col items-center gap-1">
          <div className="relative">
            {own ? (
              <OverlayLink
                to={paths.story(me.id)}
                aria-label={t("stories.open", { name: t("stories.yourStory") })}
              >
                <UserAvatar user={me} size="lg" storyRing={own.hasUnseen ? "unseen" : "seen"} />
              </OverlayLink>
            ) : (
              <UserAvatar user={me} size="lg" />
            )}
            <button
              type="button"
              onClick={() => setCreating(true)}
              aria-label={t("stories.addStory")}
              className="absolute -bottom-0.5 -end-0.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <span className="w-full truncate text-center text-xs text-muted-foreground">
            {t("stories.yourStory")}
          </span>
        </li>
        {tray.isPending &&
          ["a", "b", "c"].map((key) => (
            <li key={key} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </li>
          ))}
        {others.map((item) => (
          <li key={item.user.id} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <OverlayLink
              to={paths.story(item.user.id)}
              aria-label={t("stories.open", { name: item.user.displayName })}
              className="rounded-full"
            >
              <UserAvatar
                user={item.user}
                size="lg"
                storyRing={item.hasUnseen ? "unseen" : "seen"}
              />
            </OverlayLink>
            <span className="w-full truncate text-center text-xs">{item.user.username}</span>
          </li>
        ))}
      </ul>
      <CreateStoryDialog open={creating} onOpenChange={setCreating} />
    </section>
  );
}
