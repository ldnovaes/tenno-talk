import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { feedService, type CreatePostInput } from "@/services/feedService";
import type { Comment } from "@/types/post";

import { patchPostInCaches, prependPost, withLike } from "../lib/postCache";
import { feedKeys } from "../lib/queryKeys";

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
  return useQuery({
    queryKey: feedKeys.comments(postId ?? ""),
    queryFn: () => feedService.getComments(postId ?? ""),
    enabled: postId !== null,
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => feedService.addComment(postId, text),
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(feedKeys.comments(postId), (list) => [
        ...(list ?? []),
        comment,
      ]);
      patchPostInCaches(queryClient, postId, (post) => ({
        ...post,
        commentsCount: post.commentsCount + 1,
      }));
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
