import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { patchPostInCaches, prependPost, withLike } from "@/features/feed/lib/postCache";
import { feedKeys } from "@/features/feed/lib/queryKeys";
import type { Page } from "@/types/api";
import type { Comment, Post } from "@/types/post";

function post(id: string, authorId = "linh", extra: Partial<Post> = {}): Post {
  return {
    id,
    author: { id: authorId, username: authorId, displayName: authorId, avatarUrl: null },
    media: [],
    caption: null,
    captionTranslation: null,
    likesCount: 1,
    commentsCount: 0,
    likedByMe: false,
    createdAt: "2026-10-05T10:00:00.000Z",
    ...extra,
  };
}

const pages = <T>(...items: T[][]): InfiniteData<Page<T>, unknown> => ({
  pages: items.map((page) => ({ items: page, nextCursor: null })),
  pageParams: items.map(() => null),
});

describe("withLike", () => {
  it.each([
    [false, true, true, 2],
    [true, false, false, 0],
    [true, true, true, 1],
    [false, false, false, 1],
  ])("liked=%s → %s gives likedByMe=%s, %i likes", (from, to, liked, count) => {
    const result = withLike(post("p", "linh", { likedByMe: from, likesCount: 1 }), to);
    expect(result).toMatchObject({ likedByMe: liked, likesCount: count });
  });

  it("never goes below zero and returns the same object when nothing changes", () => {
    expect(withLike(post("p", "linh", { likedByMe: true, likesCount: 0 }), false).likesCount).toBe(
      0,
    );
    const same = post("p");
    expect(withLike(same, false)).toBe(same);
  });
});

describe("patchPostInCaches", () => {
  function seeded() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(feedKeys.list(), pages([post("p1"), post("p2")], [post("p3")]));
    queryClient.setQueryData(feedKeys.discover(), pages([post("p3"), post("p4")]));
    queryClient.setQueryData(feedKeys.user("linh"), pages([post("p3")]));
    queryClient.setQueryData(feedKeys.post("p3"), post("p3"));
    queryClient.setQueryData(feedKeys.post("p1"), post("p1"));
    const comment: Comment = {
      id: "p3",
      postId: "p3",
      author: post("x").author,
      body: { text: "same id as the post, on purpose", language: "en-US" },
      translation: null,
      createdAt: "2026-10-05T10:00:00.000Z",
    };
    queryClient.setQueryData(feedKeys.comments("p3"), pages([comment]));
    return { queryClient, comment };
  }

  it("patches the post in the feed, Discover, the author's grid and its own page", () => {
    const { queryClient } = seeded();
    patchPostInCaches(queryClient, "p3", (p) => withLike(p, true));
    const liked = (data: unknown) =>
      (data as InfiniteData<Page<Post>>).pages
        .flatMap((page) => page.items)
        .find((p) => p.id === "p3")?.likedByMe;
    expect(liked(queryClient.getQueryData(feedKeys.list()))).toBe(true);
    expect(liked(queryClient.getQueryData(feedKeys.discover()))).toBe(true);
    expect(liked(queryClient.getQueryData(feedKeys.user("linh")))).toBe(true);
    expect(queryClient.getQueryData<Post>(feedKeys.post("p3"))?.likedByMe).toBe(true);
    expect(queryClient.getQueryData<Post>(feedKeys.post("p1"))?.likedByMe).toBe(false);
  });

  it("never touches comments, even one whose id matches the post's", () => {
    const { queryClient, comment } = seeded();
    patchPostInCaches(queryClient, "p3", (p) => withLike(p, true));
    expect(
      queryClient.getQueryData<InfiniteData<Page<Comment>>>(feedKeys.comments("p3"))?.pages[0]
        ?.items[0],
    ).toEqual(comment);
  });
});

describe("prependPost", () => {
  it("puts a new post on top of the feed and of its author's grid only", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(feedKeys.list(), pages([post("p1")], [post("p0")]));
    queryClient.setQueryData(feedKeys.user("me"), pages([post("p1", "me")]));
    queryClient.setQueryData(feedKeys.user("linh"), pages([post("p9")]));
    prependPost(queryClient, post("new", "me"));
    const ids = (key: readonly unknown[]) =>
      queryClient
        .getQueryData<InfiniteData<Page<Post>>>(key)
        ?.pages.map((page) => page.items.map((p) => p.id));
    expect(ids(feedKeys.list())).toEqual([["new", "p1"], ["p0"]]);
    expect(ids(feedKeys.user("me"))).toEqual([["new", "p1"]]);
    expect(ids(feedKeys.user("linh"))).toEqual([["p9"]]);
  });

  it("does nothing for lists that were never loaded", () => {
    const queryClient = new QueryClient();
    prependPost(queryClient, post("new", "me"));
    expect(queryClient.getQueryData(feedKeys.list())).toBeUndefined();
  });
});
