import { useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { feedService, type CreatePostInput } from "@/services/feedService";
import type { Page } from "@/types/api";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import type { Comment } from "@/types/post";

import { patchPostInCaches, prependPost, withLike } from "../lib/postCache";
import { feedKeys } from "../lib/queryKeys";

export function usePost(postId: string) {
  return useQuery({ queryKey: feedKeys.post(postId), queryFn: () => feedService.getPost(postId) });
}

export function useFeed() {
  return useInfiniteQuery({
    queryKey: feedKeys.list(),
    queryFn: ({ pageParam }) => feedService.getFeed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useUserPosts(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: feedKeys.user(userId ?? ""),
    queryFn: ({ pageParam }) => feedService.getUserPosts(userId ?? "", pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: Boolean(userId),
  });
}

/** Optimistic like/unlike, rolled back on failure. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, like }: { postId: string; like: boolean }) =>
      like ? feedService.like(postId) : feedService.unlike(postId),
    onMutate: ({ postId, like }) =>
      patchPostInCaches(queryClient, postId, (post) => withLike(post, like)),
    onError: (_error, { postId, like }) =>
      patchPostInCaches(queryClient, postId, (post) => withLike(post, !like)),
    onSuccess: (post) => patchPostInCaches(queryClient, post.id, () => post),
  });
}

export function useComments(postId: string | null) {
  return useInfiniteQuery({
    queryKey: feedKeys.comments(postId ?? ""),
    queryFn: async ({ pageParam }): Promise<Page<Comment>> => {
      const items = await feedService.getComments(postId ?? "", pageParam ?? undefined);
      return { items, nextCursor: items.length === 50 ? (items.at(-1)?.id ?? null) : null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: postId !== null,
  });
}
export function useTargetComment(postId: string, target: string | null) {
  return useQuery({
    queryKey: ["comment-target", postId, target],
    queryFn: () => feedService.getComments(postId, undefined, target ?? undefined),
    enabled: !!target,
  });
}
export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const pending = useRef<{ text: string; id: string } | null>(null);
  const patch = (id: string, comment?: Comment) =>
    queryClient.setQueryData<InfiniteData<Page<Comment>>>(feedKeys.comments(postId), (data) => {
      if (!data) return data;
      const pages = data.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.id !== id && item.id !== comment?.id),
      }));
      const last = pages.at(-1);
      if (last && comment) last.items.push(comment);
      return { ...data, pages };
    });
  return useMutation({
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({ queryKey: feedKeys.comments(postId) });
      if (pending.current?.text !== text) pending.current = { text, id: crypto.randomUUID() };
      const id = `tmp_${pending.current.id}`;
      patch(id, {
        id,
        postId,
        author: me,
        body: { text, language: me.nativeLanguage },
        translation: null,
        createdAt: new Date().toISOString(),
      });
      return { id };
    },
    mutationFn: (text: string) => feedService.addComment(postId, text, pending.current?.id),
    onError: (_error, _text, context) => {
      if (context) patch(context.id);
    },
    // The comments box shows why (e.g. "Comments are limited on this post."); a toast would say it twice.
    meta: { silent: true },
    onSuccess: (comment, _text, context) => {
      if (context) patch(context.id, comment);
      pending.current = null;
      void queryClient.invalidateQueries({ queryKey: feedKeys.comments(postId) });
      void feedService
        .getPost(postId)
        .then((post) => patchPostInCaches(queryClient, postId, () => post));
    },
  });
}

export function useCreatePost(onProgress: (progress: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => feedService.createPost(input, onProgress),
    onSuccess: (post) => {
      prependPost(queryClient, post);
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}
