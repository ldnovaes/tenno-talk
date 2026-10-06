import { ImagePlus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareMedia } from "@/features/chat/lib/prepareMedia";
import type { MediaInput } from "@/services/chatService";

import { useCreateStory } from "../hooks/useStories";

/** Upload + optional text; no complex editor in the MVP (PLAN.md §9.9). */
export function CreateStoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const textId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<MediaInput | null>(null);
  const [text, setText] = useState("");
  const create = useCreateStory();

  function reset() {
    setMedia(null);
    setText("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("stories.create.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("stories.create.pick")}</DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          aria-label={t("stories.create.pick")}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) setMedia(await prepareMedia(file));
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="relative grid aspect-[9/16] max-h-[50dvh] w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed text-muted-foreground"
        >
          {media?.kind === "image" ? (
            <img src={media.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : media?.kind === "video" ? (
            <video
              src={media.url}
              muted
              loop
              autoPlay
              playsInline
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center gap-2">
              <ImagePlus className="size-8" aria-hidden />
              {t("stories.create.pick")}
            </span>
          )}
        </button>
        <div className="space-y-1.5">
          <Label htmlFor={textId}>{t("stories.create.text")}</Label>
          <Input
            id={textId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={120}
            dir="auto"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!media || create.isPending}
            onClick={() =>
              media &&
              create.mutate(
                { media, text },
                {
                  onSuccess: () => {
                    toast.success(t("stories.create.done"));
                    reset();
                    onOpenChange(false);
                  },
                },
              )
            }
          >
            {t("stories.create.share")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
