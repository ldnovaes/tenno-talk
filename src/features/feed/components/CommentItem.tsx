import { RelativeTime } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/common/UserAvatar";
import { TranslatedContent } from "@/features/translation/components/TranslatedContent";
import { useContentTranslation } from "@/features/translation/hooks/useContentTranslation";
import { useTranslationPreferences } from "@/features/translation/hooks/useTranslationPreferences";
import type { Comment } from "@/types/post";

export function CommentItem({ comment }: { comment: Comment }) {
  const { autoTranslatePosts } = useTranslationPreferences();
  const body = useContentTranslation(
    { kind: "comment", id: comment.id },
    comment.body,
    comment.translation,
    autoTranslatePosts,
  );
  return (
    <li id={`comment-item-${comment.id}`} className="flex gap-3 py-3 target:bg-accent">
      <UserAvatar user={comment.author} size="xs" />
      <div className="min-w-0 flex-1 text-sm">
        <TranslatedContent
          state={body}
          prefix={<span className="me-1.5 font-semibold">{comment.author.username}</span>}
        />
        <RelativeTime iso={comment.createdAt} className="text-xs text-muted-foreground" />
      </div>
    </li>
  );
}
