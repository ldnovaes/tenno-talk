import type { Page } from "@/types/api";
import type { DiscoverEvent } from "@/types/discover";
import type { Post } from "@/types/post";

import { mockDiscoverService } from "./mock/implementations/mockDiscoverService";
import { httpDiscoverService } from "./http/httpDiscoverService";

/** Discover "For You" (PLAN.md §37): posts ranked by the server; the client reports what it showed. */
export interface DiscoverService {
  getPosts(cursor: string | null): Promise<Page<Post>>;
  /** {@code keepalive} lets the request outlive the page (flush on tab close). */
  trackEvents(events: DiscoverEvent[], options?: { keepalive?: boolean }): Promise<void>;
  unhidePost(postId: string): Promise<void>;
  unhideAuthor(authorId: string): Promise<void>;
}

export const discoverService: DiscoverService = __USE_HTTP__
  ? httpDiscoverService
  : mockDiscoverService;
