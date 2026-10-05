import { toast } from "sonner";

import { paths } from "@/app/router/paths";
import type { Post } from "@/types/post";

/** Web Share on phones, link copied elsewhere. */
export async function sharePost(post: Post, copiedMessage: string): Promise<void> {
  const url = `${window.location.origin}${paths.post(post.id)}`;
  if (navigator.share) {
    await navigator.share({ url }).catch(() => undefined);
    return;
  }
  await navigator.clipboard?.writeText(url);
  toast.success(copiedMessage);
}
