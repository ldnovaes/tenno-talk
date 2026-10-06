import type { DiscoverService } from "@/services/discoverService";
import type { Page } from "@/types/api";
import type { Post } from "@/types/post";

import { http } from "./httpClient";

export const httpDiscoverService: DiscoverService = {
  getPosts: (cursor) => http<Page<Post>>("GET", "/api/discover", { query: { cursor } }),
  trackEvents: (events, options) =>
    http<void>("POST", "/api/discover/events", {
      body: { events },
      keepalive: options?.keepalive ?? false,
    }),
  unhidePost: (postId) =>
    http<void>("DELETE", `/api/discover/hidden/posts/${encodeURIComponent(postId)}`),
  unhideAuthor: (authorId) =>
    http<void>("DELETE", `/api/discover/hidden/authors/${encodeURIComponent(authorId)}`),
};
