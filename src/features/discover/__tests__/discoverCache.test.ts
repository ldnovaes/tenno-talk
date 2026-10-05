import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { Page } from "@/types/api";

import type { Post } from "@/types/post";

import { removePosts, restorePosts } from "../lib/discoverCache";

function post(id: string, author: string): Post {
  return {
    id,
    author: { id: author, username: author, displayName: author, avatarUrl: null },
    media: [],
    caption: null,
    captionTranslation: null,
    likesCount: 0,
    commentsCount: 0,
    likedByMe: false,
    createdAt: "2026-10-05T12:00:00Z",
  };
}

const data: InfiniteData<Page<Post>, unknown> = {
  pageParams: [null, "c1"],
  pages: [
    { items: [post("1", "a"), post("2", "b"), post("3", "a")], nextCursor: "c1" },
    { items: [post("4", "a"), post("5", "c")], nextCursor: null },
  ],
};

const ids = (value: InfiniteData<Page<Post>, unknown>) =>
  value.pages.map((page) => page.items.map((item) => item.id));

describe("removePosts / restorePosts", () => {
  it("removes every post of an author across pages and puts them back in place", () => {
    const { data: without, removed } = removePosts(data, (p) => p.author.id === "a");
    expect(ids(without)).toEqual([["2"], ["5"]]);
    expect(removed.map((entry) => entry.post.id)).toEqual(["1", "3", "4"]);
    expect(ids(restorePosts(without, removed))).toEqual(ids(data));
  });

  it("does not duplicate a post that came back another way", () => {
    const { data: without, removed } = removePosts(data, (p) => p.id === "2");
    const refetched = {
      ...without,
      pages: [
        { ...without.pages[0]!, items: [post("2", "b"), ...without.pages[0]!.items] },
        without.pages[1]!,
      ],
    };
    expect(ids(restorePosts(refetched, removed))[0]).toEqual(["2", "1", "3"]);
  });

  it("leaves the original data untouched", () => {
    removePosts(data, () => true);
    expect(ids(data)).toEqual([
      ["1", "2", "3"],
      ["4", "5"],
    ]);
  });
});
