import { useSearchParams } from "react-router";
import { useContentDraft } from "../hooks/useContentDraft";
import { useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/types/post";
import { useAddComment, useComments, useTargetComment } from "../hooks/useFeed";
import { CommentItem } from "./CommentItem";
export function CommentsBody({ post }: { post: Post }) {
  const { t } = useTranslation();
  const comments = useComments(post.id);
  const add = useAddComment(post.id);
  const [text, setText] = useContentDraft(`post:${post.id}`);
  const [params] = useSearchParams();
  const target = params.get("commentId");
  const targeted = useTargetComment(post.id, target);
  const list = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const missingTarget =
    targeted.data?.filter((item) => !list.some((comment) => comment.id === item.id)) ?? [];
  useEffect(() => {
    if (target && comments.data)
      document.getElementById(`comment-item-${target}`)?.scrollIntoView?.({ block: "center" });
  }, [target, comments.data, targeted.data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const submitted = text;
    add.mutate(text, {
      onSuccess: () => setText((current) => (current === submitted ? "" : current)),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-40 flex-1 overflow-y-auto px-4 py-3 md:px-6">
        {comments.isError && (
          <li>
            <ErrorState onRetry={() => void comments.refetch()} />
          </li>
        )}
        {comments.isPending && <Skeleton className="my-3 h-10" />}
        {comments.isSuccess && list.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">{t("feed.noComments")}</li>
        )}
        {[...missingTarget, ...list].map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
        {comments.hasNextPage && (
          <li>
            <Button
              variant="ghost"
              disabled={comments.isFetchingNextPage}
              onClick={() => void comments.fetchNextPage()}
            >
              {t("common.loadMore")}
            </Button>
          </li>
        )}
      </ul>
      {add.isError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {t("errors.generic")}
        </p>
      )}
      <form onSubmit={submit} className="flex items-end gap-3 border-t p-4 pb-safe md:px-6">
        <Textarea
          id={`comment-${post.id}`}
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("feed.addComment")}
          aria-label={t("feed.addComment")}
          dir="auto"
        />
        <Button type="submit" disabled={!text.trim() || add.isPending}>
          {t("feed.send")}
        </Button>
      </form>
    </div>
  );
}
