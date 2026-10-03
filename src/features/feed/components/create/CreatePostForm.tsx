import { MapPin, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareMedia } from "@/features/chat/lib/prepareMedia";
import type { MediaInput } from "@/services/chatService";
import type { Post } from "@/types/post";

import { useCreatePost } from "../../hooks/useFeed";
import { MediaPicker } from "./MediaPicker";

/** Select media → caption → share with progress (PLAN.md §9.8). */
export function CreatePostForm({ onPublished }: { onPublished: (post: Post) => void }) {
  const { t } = useTranslation();
  const captionId = useId();
  const [media, setMedia] = useState<MediaInput[]>([]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const create = useCreatePost(setProgress);

  async function add(files: File[]) {
    const prepared = await Promise.all(files.map(prepareMedia));
    setMedia((current) => [...current, ...prepared.filter((item) => item.kind !== "file")]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (media.length === 0) return;
    create.mutate(
      { media, caption },
      {
        onSuccess: (post) => {
          toast.success(t("feed.createPost.done"));
          onPublished(post);
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-5">
      <MediaPicker
        media={media}
        onAdd={(files) => void add(files)}
        onRemove={(index) => setMedia((current) => current.filter((_, i) => i !== index))}
      />
      <div className="space-y-2">
        <Label htmlFor={captionId}>{t("feed.createPost.caption")}</Label>
        <Textarea
          id={captionId}
          rows={3}
          maxLength={2200}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder={t("feed.createPost.captionPlaceholder")}
          dir="auto"
        />
      </div>
      <div className="flex gap-2">
        {/* Reserved for the future (PLAN.md §9.8). */}
        <Button type="button" variant="outline" size="sm" disabled>
          <MapPin className="size-4" aria-hidden />
          {t("feed.createPost.location")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled>
          <UserPlus className="size-4" aria-hidden />
          {t("feed.createPost.tag")}
        </Button>
      </div>
      {create.isPending && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <Button type="submit" disabled={media.length === 0 || create.isPending}>
        {create.isPending
          ? t("feed.createPost.publishing", { percent: Math.round(progress * 100) })
          : t("feed.createPost.publish")}
      </Button>
    </form>
  );
}
