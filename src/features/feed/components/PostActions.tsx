import { Heart, MessageCircle, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Post } from "@/types/post";

import { useToggleLike } from "../hooks/useFeed";
import { sharePost } from "../lib/share";

export function PostActions({ post, onComment }: { post: Post; onComment: () => void }) {
  const { t } = useTranslation();
  const toggle = useToggleLike();
  return (
    <div className="flex items-center gap-1 px-2">
      <Button
        variant="ghost"
        size="icon"
        aria-pressed={post.likedByMe}
        aria-label={post.likedByMe ? t("feed.unlike") : t("feed.like")}
        onClick={() => toggle.mutate({ postId: post.id, like: !post.likedByMe })}
      >
        <Heart
          className={cn(
            "size-6 transition-transform active:scale-90",
            post.likedByMe && "fill-destructive text-destructive",
          )}
        />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t("feed.comment")} onClick={onComment}>
        <MessageCircle className="size-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("feed.share")}
        onClick={() => void sharePost(post, t("feed.linkCopied"))}
      >
        <Send className="size-6 rtl:-scale-x-100" />
      </Button>
    </div>
  );
}
