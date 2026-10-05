import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { feedKeys } from "@/features/feed/lib/queryKeys";
import { discoverService } from "@/services/discoverService";
import type { Page } from "@/types/api";
import type { Post } from "@/types/post";

import { removePosts, restorePosts } from "../lib/discoverCache";
import { toDiscoverEvents } from "../lib/engagement";

type Scope = "post" | "author";

/**
 * "Not interested": the post (or every post of the author) leaves Discover at once, and the server never
 * shows it again; "Undo" puts it back in place and on the server.
 */
export function useNotInterested() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useCallback(
    (post: Post, scope: Scope) => {
      const key = feedKeys.discover();
      const data = queryClient.getQueryData<InfiniteData<Page<Post>, unknown>>(key);
      const match = (other: Post) =>
        scope === "post" ? other.id === post.id : other.author.id === post.author.id;
      const removed = data ? removePosts(data, match) : null;
      if (removed) queryClient.setQueryData(key, removed.data);

      const kind = scope === "post" ? "hide_post" : "hide_author";
      const sent = discoverService.trackEvents(
        toDiscoverEvents([{ kind, postId: post.id }], Date.now()),
      );
      const undo = async () => {
        await sent.catch(() => undefined);
        await (scope === "post"
          ? discoverService.unhidePost(post.id)
          : discoverService.unhideAuthor(post.author.id));
        queryClient.setQueryData<InfiniteData<Page<Post>, unknown>>(key, (current) =>
          current && removed ? restorePosts(current, removed.removed) : current,
        );
      };
      sent.catch(() => toast.error(t("discover.hideFailed")));
      toast(
        scope === "post"
          ? t("discover.hiddenPost")
          : t("discover.hiddenAuthor", { username: post.author.username }),
        {
          action: {
            label: t("common.undo"),
            onClick: () => void undo().catch(() => toast.error(t("discover.undoFailed"))),
          },
        },
      );
    },
    [queryClient, t],
  );
}
