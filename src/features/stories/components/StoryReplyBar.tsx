import { useContentDraft } from "@/features/feed/hooks/useContentDraft";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Story } from "@/types/story";

import { useReactToStory, useReplyToStory } from "../hooks/useStories";

const REACTIONS = ["❤️", "😂", "😮", "👏"] as const;

export function StoryReplyBar({
  story,
  onFocusChange,
}: {
  story: Story;
  onFocusChange: (focused: boolean) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useContentDraft(`story:${story.id}`);
  const [focused, setFocused] = useState(false);
  const reply = useReplyToStory();
  const react = useReactToStory();

  useEffect(() => {
    onFocusChange(focused || reply.isPending || react.isPending || text.length > 0);
  }, [focused, reply.isPending, react.isPending, text, onFocusChange]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    reply.mutate(
      { storyId: story.id, text },
      {
        onSuccess: (result) => {
          setText((current) => (current === text ? "" : current));
          setFocused(false);
          toast.success(t(result.queued ? "stories.queuedReply" : "stories.replied"));
        },
      },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={t("stories.react", { emoji })}
            onClick={() =>
              react.mutate(
                { storyId: story.id, emoji },
                { onSuccess: () => toast.success(t("stories.reacted")) },
              )
            }
            className="grid size-10 place-items-center rounded-full bg-white/10 text-xl transition-transform hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-white/80">{t("stories.privateReply")}</p>
      {reply.isError && (
        <p role="alert" className="text-sm text-white">
          {t("errors.generic")}
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <textarea
          rows={1}
          maxLength={4000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("stories.reply", { name: story.author.displayName })}
          aria-label={t("stories.reply", { name: story.author.displayName })}
          dir="auto"
          className="min-h-11 max-h-32 resize-y py-2.5 min-w-0 flex-1 rounded-full border border-white/40 bg-transparent px-4 text-white outline-none placeholder:text-white/60 focus:border-white"
        />
        <Button
          type="submit"
          disabled={!text.trim() || reply.isPending}
          className="h-11 rounded-full"
        >
          {t("stories.send")}
        </Button>
      </form>
    </div>
  );
}
