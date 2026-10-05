import { Compass } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/types/post";

import { useActiveSlide } from "../hooks/useActiveSlide";
import { useDiscoverFeed } from "../hooks/useDiscoverFeed";
import { useEngagementTracker } from "../hooks/useEngagementTracker";
import { DiscoverSlide } from "./DiscoverSlide";

/** Slides left before the next page is fetched. */
export const PREFETCH_AHEAD = 3;

const NEXT_KEYS = new Set(["ArrowDown", "PageDown", "j"]);
const PREVIOUS_KEYS = new Set(["ArrowUp", "PageUp", "k"]);

/** Vertical, one-post-per-screen Discover feed (PLAN.md §37.7). */
export function DiscoverFeed() {
  const { t } = useTranslation();
  const feed = useDiscoverFeed();
  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const ids = useMemo(() => posts.map((post) => post.id), [posts]);
  const container = useRef<HTMLDivElement>(null);
  const active = useActiveSlide(container, ids);
  const { setActive, record } = useEngagementTracker();
  const open = useOverlayNavigate();
  const reducedMotion = useReducedMotion();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;

  useEffect(() => setActive(active), [active, setActive]);

  useEffect(() => {
    const index = active === null ? -1 : ids.indexOf(active);
    if (index >= ids.length - PREFETCH_AHEAD && hasNextPage && !isFetchingNextPage)
      void fetchNextPage();
  }, [active, ids, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;
    const element = container.current;
    if (direction === 0 || !element) return;
    event.preventDefault();
    element.scrollBy({
      top: direction * element.clientHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const onComment = useCallback((post: Post) => open(paths.post(post.id)), [open]);
  const onProfileOpen = useCallback((post: Post) => record("profile_open", post.id), [record]);
  const onShare = useCallback((post: Post) => record("share", post.id), [record]);

  if (feed.isPending)
    return <Skeleton className="m-4 flex-1 rounded-xl" aria-label={t("common.loading")} />;
  if (feed.isError) return <ErrorState onRetry={() => void feed.refetch()} />;
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title={t("discover.empty")}
        description={t("discover.emptyDescription")}
      />
    );
  }
  return (
    <div
      ref={container}
      role="feed"
      aria-label={t("discover.feedLabel")}
      aria-busy={isFetchingNextPage}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black focus-visible:outline-none"
    >
      {posts.map((post) => (
        <DiscoverSlide
          key={post.id}
          post={post}
          active={post.id === active}
          onComment={onComment}
          onProfileOpen={onProfileOpen}
          onShare={onShare}
        />
      ))}
      {hasNextPage ? (
        <InfiniteScrollTrigger onVisible={() => !isFetchingNextPage && void fetchNextPage()} />
      ) : (
        <p className="grid h-full snap-start place-items-center p-8 text-center text-sm text-white/80">
          {t("discover.end")}
        </p>
      )}
    </div>
  );
}
