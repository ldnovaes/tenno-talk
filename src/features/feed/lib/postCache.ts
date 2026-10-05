import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { Page } from "@/types/api";
import type { Post } from "@/types/post";

import { feedKeys } from "./queryKeys";

type PostEntry = Post | InfiniteData<Page<Post>, unknown> | undefined;

function isInfinite(value: unknown): value is InfiniteData<Page<Post>, unknown> {
  return typeof value === "object" && value !== null && "pages" in value;
}

/** Every query under "feed" holds posts except the comment lists. */
function isPostQuery(query: { queryKey: readonly unknown[] }): boolean {
  return query.queryKey[1] !== feedKeys.comments("")[1];
}

/** Applies a patch to a post in every feed cache (feed, profile grids, single post). */
export function patchPostInCaches(
  queryClient: QueryClient,
  postId: string,
  patch: (post: Post) => Post,
): void {
  const holdsPosts = { queryKey: feedKeys.all, predicate: isPostQuery };
  queryClient.setQueriesData<PostEntry>(holdsPosts, (entry) => {
    if (!entry) return entry;
    if (isInfinite(entry)) {
      return {
        ...entry,
        pages: entry.pages.map((page) => ({
          ...page,
          items: page.items.map((post) => (post.id === postId ? patch(post) : post)),
        })),
      };
    }
    if ("media" in entry && entry.id === postId) return patch(entry);
    return entry;
  });
}

/** New post on top of the feed and of the author's grid. */
export function prependPost(queryClient: QueryClient, post: Post): void {
  for (const key of [feedKeys.list(), feedKeys.user(post.author.id)]) {
    queryClient.setQueryData<InfiniteData<Page<Post>, unknown>>(key, (data) => {
      if (!data) return data;
      const [first, ...rest] = data.pages;
      if (!first) return data;
      return { ...data, pages: [{ ...first, items: [post, ...first.items] }, ...rest] };
    });
  }
}

export function withLike(post: Post, liked: boolean): Post {
  if (post.likedByMe === liked) return post;
  return { ...post, likedByMe: liked, likesCount: Math.max(0, post.likesCount + (liked ? 1 : -1)) };
}
