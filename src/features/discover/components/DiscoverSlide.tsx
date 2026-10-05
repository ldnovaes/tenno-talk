import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OverlayLink } from "@/app/router/OverlayLink";
import { paths } from "@/app/router/paths";
import { UserAvatar } from "@/components/common/UserAvatar";
import { MediaCarousel } from "@/features/feed/components/MediaCarousel";
import { useToggleLike } from "@/features/feed/hooks/useFeed";
import { TranslatedContent } from "@/features/translation/components/TranslatedContent";
import { useContentTranslation } from "@/features/translation/hooks/useContentTranslation";
import { useTranslationPreferences } from "@/features/translation/hooks/useTranslationPreferences";
import type { Post } from "@/types/post";

import { DiscoverSlideActions } from "./DiscoverSlideActions";

/** One post filling the Discover viewport (PLAN.md §37.7): media, author, caption and actions over it. */
function DiscoverSlideComponent({
  post,
  active,
  onComment,
  onProfileOpen,
  onShare,
}: {
  post: Post;
  active: boolean;
  onComment: (post: Post) => void;
  onProfileOpen: (post: Post) => void;
  onShare: (post: Post) => void;
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
  const likeFromMedia = () => {
    setBurst((value) => value + 1);
    if (!post.likedByMe) toggle.mutate({ postId: post.id, like: true });
  };

  return (
    <article
      data-post-id={post.id}
      aria-label={t("feed.postBy", { name: post.author.displayName })}
      className="relative h-full shrink-0 snap-start snap-always bg-black"
    >
      <div onDoubleClick={likeFromMedia} className="absolute inset-0">
        <MediaCarousel media={post.media} fill playing={active} />
      </div>
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pb-4 pe-20 pt-16 text-white">
        <OverlayLink
          to={paths.profile(post.author.username)}
          onClick={() => onProfileOpen(post)}
          className="pointer-events-auto flex w-fit max-w-full items-center gap-2"
        >
          <UserAvatar user={post.author} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{post.author.displayName}</span>
            <span className="block truncate text-xs text-white/80">@{post.author.username}</span>
          </span>
        </OverlayLink>
        {post.caption && (
          <TranslatedContent
            state={caption}
            className="pointer-events-auto line-clamp-4 text-sm [&_button]:text-white/80"
          />
        )}
      </div>
      <DiscoverSlideActions
        post={post}
        onComment={() => onComment(post)}
        onShare={() => onShare(post)}
        className="absolute bottom-4 end-2"
      />
    </article>
  );
}

export const DiscoverSlide = memo(DiscoverSlideComponent);
