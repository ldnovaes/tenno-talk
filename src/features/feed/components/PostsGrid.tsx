import { Copy, Play } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";

import { useUserPosts } from "../hooks/useFeed";

/** Profile grid (3 columns) opening a post viewer. */
export function PostsGrid({ userId, empty }: { userId: string; empty: ReactNode }) {
  const { t } = useTranslation();
  const posts = useUserPosts(userId);
  const open = useOverlayNavigate();
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];

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
                onClick={() => open(paths.post(post.id))}
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
    </>
  );
}
