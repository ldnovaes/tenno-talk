import type { Page } from "@/types/api";
import type { Comment, Post } from "@/types/post";

import type { MediaInput } from "./chatService";
import { mockFeedService } from "./mock/implementations/mockFeedService";
import { httpFeedService } from "./http/httpFeedService";

export interface CreatePostInput {
  media: MediaInput[];
  caption: string;
}

export interface FeedService {
  getFeed(cursor: string | null): Promise<Page<Post>>;
  getUserPosts(userId: string, cursor: string | null): Promise<Page<Post>>;
  getPost(postId: string): Promise<Post>;
  like(postId: string): Promise<Post>;
  unlike(postId: string): Promise<Post>;
  getComments(postId: string): Promise<Comment[]>;
  addComment(postId: string, text: string): Promise<Comment>;
  /** Upload + create; progress in [0, 1] (real uploads report it in Phase 8). */
  createPost(input: CreatePostInput, onProgress?: (progress: number) => void): Promise<Post>;
}

export const feedService: FeedService = __USE_HTTP__ ? httpFeedService : mockFeedService;
