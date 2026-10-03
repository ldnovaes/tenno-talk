import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OverlayLink } from "@/app/router/OverlayLink";
import { paths } from "@/app/router/paths";
import { RelativeTime } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/common/UserAvatar";
import { TranslatedContent } from "@/features/translation/components/TranslatedContent";
import { useContentTranslation } from "@/features/translation/hooks/useContentTranslation";
import { useTranslationPreferences } from "@/features/translation/hooks/useTranslationPreferences";
import type { Post } from "@/types/post";

import { useToggleLike } from "../hooks/useFeed";
import { MediaCarousel } from "./MediaCarousel";
import { PostActions } from "./PostActions";

function PostCardComponent({
  post,
  onOpenComments,
}: {
  post: Post;
  onOpenComments: (post: Post) => void;
}) {
  const { t } = useTranslation();
  const { autoTranslatePosts } = useTranslationPreferences();
  const caption = useContentTranslation(
    { kind: "post", id: post.id },
    post.caption,
    post.captionTranslation,
    autoTranslatePosts,
  );
  const toggle = useToggleLike();
  const [burst, setBurst] = useState(0);

  // Double tap / double click on the media likes (never unlikes).
  const likeFromMedia = () => {
    setBurst((value) => value + 1);
    if (!post.likedByMe) toggle.mutate({ postId: post.id, like: true });
  };

  return (
    <article
      aria-label={t("feed.postBy", { name: post.author.displayName })}
      className="border-b pb-3 md:border-b-0"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <OverlayLink
          to={paths.profile(post.author.username)}
          className="flex min-w-0 items-center gap-3"
        >
          <UserAvatar user={post.author} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{post.author.displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              @{post.author.username}
            </span>
          </span>
        </OverlayLink>
        <RelativeTime iso={post.createdAt} className="ms-auto text-xs text-muted-foreground" />
      </header>
      <div onDoubleClick={likeFromMedia} className="md:overflow-hidden md:rounded-xl">
        <MediaCarousel
          media={post.media}
          overlay={
            <AnimatePresence>
              {burst > 0 && (
                <motion.span
                  key={burst}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 1] }}
                  transition={{ duration: 0.8 }}
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                  aria-hidden
                >
                  <Heart className="size-24 fill-white text-white drop-shadow-lg" />
                </motion.span>
              )}
            </AnimatePresence>
          }
        />
      </div>
      <PostActions post={post} onComment={() => onOpenComments(post)} />
      <div className="space-y-1 px-4 text-sm">
        {post.likesCount > 0 && (
          <p className="font-semibold">{t("feed.likes", { count: post.likesCount })}</p>
        )}
        {post.caption && (
          <TranslatedContent
            state={caption}
            prefix={<span className="me-1.5 font-semibold">{post.author.username}</span>}
          />
        )}
        {post.commentsCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenComments(post)}
            className="text-muted-foreground"
          >
            {t("feed.comments", { count: post.commentsCount })}
          </button>
        )}
      </div>
    </article>
  );
}

export const PostCard = memo(PostCardComponent);
