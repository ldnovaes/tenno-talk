import type { FeedService } from "@/services/feedService";
import type { Page } from "@/types/api";
import type { Comment, Post } from "@/types/post";

import { http } from "./httpClient";
import { uploadMedia } from "./media";

const post = (id: string) => `/api/posts/${encodeURIComponent(id)}`;

/** Uploading is most of the work; the last 10% is creating the post. */
const UPLOAD_SHARE = 0.9;

export const httpFeedService: FeedService = {
  getFeed: (cursor) => http<Page<Post>>("GET", "/api/feed", { query: { cursor } }),

  getUserPosts: (userId, cursor) =>
    http<Page<Post>>("GET", `/api/users/${encodeURIComponent(userId)}/posts`, {
      query: { cursor },
    }),

  getPost: (id) => http<Post>("GET", post(id)),

  like: (id) => http<Post>("PUT", `${post(id)}/like`),

  unlike: (id) => http<Post>("DELETE", `${post(id)}/like`),

  getComments: (id) => http<Comment[]>("GET", `${post(id)}/comments`),

  addComment: (id, text) => http<Comment>("POST", `${post(id)}/comments`, { body: { text } }),

  async createPost(input, onProgress) {
    const media = await uploadMedia(input.media, (fraction) =>
      onProgress?.(fraction * UPLOAD_SHARE),
    );
    const created = await http<Post>("POST", "/api/posts", {
      body: { mediaIds: media.map((item) => item.id), caption: input.caption },
    });
    onProgress?.(1);
    return created;
  },
};
