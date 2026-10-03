import { ImagePlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { Button } from "@/components/ui/button";
import type { Post } from "@/types/post";

import { useFeed } from "../hooks/useFeed";
import { CommentsPanel } from "./CommentsPanel";
import { FeedPostSkeleton } from "./FeedPostSkeleton";
import { PostCard } from "./PostCard";

export function FeedList() {
  const { t } = useTranslation();
  const feed = useFeed();
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];

  if (feed.isPending) return <FeedPostSkeleton />;
  if (feed.isError) return <ErrorState onRetry={() => void feed.refetch()} />;
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={ImagePlus}
        title={t("feed.empty")}
        description={t("feed.emptyDescription")}
        action={
          <Button asChild>
            <Link to={paths.create()}>{t("feed.create")}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <>
      <div className="md:space-y-4 md:px-4 md:py-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onOpenComments={setCommentsFor} />
        ))}
      </div>
      {feed.hasNextPage ? (
        <>
          <InfiniteScrollTrigger
            onVisible={() => !feed.isFetchingNextPage && void feed.fetchNextPage()}
          />
          {feed.isFetchingNextPage && <FeedPostSkeleton />}
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("feed.end")}</p>
      )}
      <CommentsPanel post={commentsFor} onClose={() => setCommentsFor(null)} />
    </>
  );
}
