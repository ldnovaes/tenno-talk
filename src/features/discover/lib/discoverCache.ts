import type { InfiniteData } from "@tanstack/react-query";

import type { Page } from "@/types/api";
import type { Post } from "@/types/post";

type Pages = InfiniteData<Page<Post>, unknown>;

/** Where a removed post was, so "Undo" puts it back in place. */
export interface Removed {
  page: number;
  index: number;
  post: Post;
}

/** Removes matching posts ("Not interested"); returns what was removed, in order. */
export function removePosts(
  data: Pages,
  match: (post: Post) => boolean,
): { data: Pages; removed: Removed[] } {
  const removed: Removed[] = [];
  const pages = data.pages.map((page, pageIndex) => ({
    ...page,
    items: page.items.filter((post, index) => {
      if (!match(post)) return true;
      removed.push({ page: pageIndex, index, post });
      return false;
    }),
  }));
  return { data: { ...data, pages }, removed };
}

/** Puts removed posts back where they were (skipping any that came back some other way). */
export function restorePosts(data: Pages, removed: Removed[]): Pages {
  const present = new Set(data.pages.flatMap((page) => page.items.map((post) => post.id)));
  const pages = data.pages.map((page) => ({ ...page, items: [...page.items] }));
  for (const entry of removed) {
    const page = pages[entry.page];
    if (!page || present.has(entry.post.id)) continue;
    page.items.splice(Math.min(entry.index, page.items.length), 0, entry.post);
    present.add(entry.post.id);
  }
  return { ...data, pages };
}
