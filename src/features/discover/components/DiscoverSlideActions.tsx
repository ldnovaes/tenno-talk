import { Heart, MessageCircle, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useToggleLike } from "@/features/feed/hooks/useFeed";
import { sharePost } from "@/features/feed/lib/share";
import { formatCompact } from "@/lib/numbers";
import { cn } from "@/lib/utils";
import type { Post } from "@/types/post";

import { DiscoverSlideMenu } from "./DiscoverSlideMenu";

function Action({
  label,
  count,
  onClick,
  pressed,
  children,
}: {
  label: string;
  count?: number;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  const { i18n } = useTranslation();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex min-h-11 min-w-11 flex-col items-center gap-0.5 text-xs font-semibold text-white drop-shadow"
    >
      {children}
      {count !== undefined && count > 0 && <span>{formatCompact(count, i18n.language)}</span>}
    </button>
  );
}

/** Vertical actions over the media, thumb-reachable (PLAN.md §37.7). */
export function DiscoverSlideActions({
  post,
  onComment,
  onShare,
  className,
}: {
  post: Post;
  onComment: () => void;
  onShare: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const toggle = useToggleLike();
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <Action
        label={post.likedByMe ? t("feed.unlike") : t("feed.like")}
        pressed={post.likedByMe}
        count={post.likesCount}
        onClick={() => toggle.mutate({ postId: post.id, like: !post.likedByMe })}
      >
        <Heart className={cn("size-7", post.likedByMe && "fill-destructive text-destructive")} />
      </Action>
      <Action label={t("feed.comment")} count={post.commentsCount} onClick={onComment}>
        <MessageCircle className="size-7" />
      </Action>
      <Action
        label={t("feed.share")}
        onClick={() => {
          onShare();
          void sharePost(post, t("feed.linkCopied"));
        }}
      >
        <Send className="size-7 rtl:-scale-x-100" />
      </Action>
      <DiscoverSlideMenu post={post} />
    </div>
  );
}
