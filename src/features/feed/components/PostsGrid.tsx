import { Copy, Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/types/post";

import { useUserPosts } from "../hooks/useFeed";
import { CommentsPanel } from "./CommentsPanel";
import { PostCard } from "./PostCard";

/** Profile grid (3 columns) opening a post viewer. */
export function PostsGrid({ userId, empty }: { userId: string; empty: ReactNode }) {
  const { t } = useTranslation();
  const posts = useUserPosts(userId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];
  const open = items.find((post) => post.id === openId) ?? null;

  if (posts.isPending) {
    return (
      <div className="grid grid-cols-3 gap-0.5 pt-0.5">
        {["a", "b", "c"].map((key) => (
          <Skeleton key={key} className="aspect-square rounded-none" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <>{empty}</>;
  return (
    <>
      <ul className="grid grid-cols-3 gap-0.5 pt-0.5">
        {items.map((post) => {
          const cover = post.media[0];
          return (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => setOpenId(post.id)}
                aria-label={t("feed.openPost")}
                className="relative block aspect-square w-full overflow-hidden bg-muted"
              >
                {cover?.kind === "image" ? (
                  <img
                    src={cover.thumbnailUrl ?? cover.url}
                    alt={cover.alt ?? ""}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Play
                    className="absolute inset-0 m-auto size-8 text-muted-foreground"
                    aria-hidden
                  />
                )}
                {post.media.length > 1 && (
                  <Copy
                    className="absolute end-1.5 top-1.5 size-4 text-white drop-shadow"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {posts.hasNextPage && (
        <InfiniteScrollTrigger
          onVisible={() => !posts.isFetchingNextPage && void posts.fetchNextPage()}
        />
      )}
      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpenId(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">
            {open ? t("feed.postBy", { name: open.author.displayName }) : ""}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("feed.openPost")}</DialogDescription>
          {open && <PostCard post={open} onOpenComments={setCommentsFor} />}
        </DialogContent>
      </Dialog>
      <CommentsPanel post={commentsFor} onClose={() => setCommentsFor(null)} />
    </>
  );
}
