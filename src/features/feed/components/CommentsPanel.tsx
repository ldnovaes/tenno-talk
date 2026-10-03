import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useBreakpoint";
import type { Post } from "@/types/post";

import { useAddComment, useComments } from "../hooks/useFeed";
import { CommentItem } from "./CommentItem";

function CommentsBody({ post }: { post: Post }) {
  const { t } = useTranslation();
  const comments = useComments(post.id);
  const add = useAddComment(post.id);
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    add.mutate(text, { onSuccess: () => setText("") });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-40 flex-1 overflow-y-auto px-4">
        {comments.isPending && <Skeleton className="my-3 h-10" />}
        {comments.data?.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">{t("feed.noComments")}</li>
        )}
        {comments.data?.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2 border-t p-3 pb-safe">
        <Input
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

/** Comments: drawer on mobile, dialog on desktop. */
export function CommentsPanel({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const open = post !== null;
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{t("feed.commentsTitle")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("feed.commentsTitle")}</DrawerDescription>
          </DrawerHeader>
          {post && <CommentsBody post={post} />}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[80dvh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{t("feed.commentsTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("feed.commentsTitle")}</DialogDescription>
        </DialogHeader>
        {post && <CommentsBody post={post} />}
      </DialogContent>
    </Dialog>
  );
}
