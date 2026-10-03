import { Mic, Paperclip, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { MediaInput } from "@/services/chatService";

import { useSendMessage } from "../../hooks/useSendMessage";
import { useTypingEmitter } from "../../hooks/useTypingEmitter";
import { prepareMedia } from "../../lib/prepareMedia";
import { useComposerStore } from "../../stores/composerStore";
import { AttachmentPreview } from "./AttachmentPreview";
import { EmojiButton } from "./EmojiButton";
import { ReplyPreviewBar } from "./ReplyPreviewBar";

const MAX_HEIGHT = 144;

interface ComposerProps {
  conversationId: string;
  senderName: (senderId: string) => string;
  viewerId: string;
}

export function Composer({ conversationId, senderName, viewerId }: ComposerProps) {
  const { t } = useTranslation();
  const draft = useComposerStore((state) => state.drafts[conversationId] ?? "");
  const setDraft = useComposerStore((state) => state.setDraft);
  const replyTo = useComposerStore((state) => state.replyTo[conversationId] ?? null);
  const setReplyTo = useComposerStore((state) => state.setReplyTo);
  const [media, setMedia] = useState<MediaInput[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { send } = useSendMessage(conversationId);
  const typing = useTypingEmitter(conversationId);
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const canSend = draft.trim().length > 0 || media.length > 0;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [draft]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    send(draft, media, replyTo);
    setMedia([]);
    typing.stop();
    textareaRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && replyTo) setReplyTo(conversationId, null);
    // Enter sends on keyboards; on touch screens Enter inserts a new line.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !coarsePointer
    ) {
      event.preventDefault();
      submit();
    }
  }

  function insertEmoji(emoji: string) {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? draft.length;
    const end = element?.selectionEnd ?? draft.length;
    setDraft(conversationId, draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const prepared = await Promise.all(Array.from(files).map(prepareMedia));
    setMedia((current) => [...current, ...prepared]);
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-t bg-background px-2 pb-safe pt-2 md:px-4">
      {replyTo && (
        <ReplyPreviewBar
          reference={replyTo}
          senderName={
            replyTo.senderId === viewerId ? t("common.you") : senderName(replyTo.senderId)
          }
          onCancel={() => setReplyTo(conversationId, null)}
        />
      )}
      <AttachmentPreview
        media={media}
        onRemove={(index) => setMedia((current) => current.filter((_, i) => i !== index))}
      />
      <div className="flex items-end gap-2 pb-2">
        <div className="flex min-w-0 flex-1 items-end rounded-3xl bg-muted px-1">
          <EmojiButton onSelect={insertEmoji} />
          <label htmlFor={`composer-${conversationId}`} className="sr-only">
            {t("chat.composer.placeholder")}
          </label>
          <textarea
            id={`composer-${conversationId}`}
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(event) => {
              setDraft(conversationId, event.target.value);
              typing.onInput();
            }}
            onKeyDown={onKeyDown}
            onBlur={typing.stop}
            placeholder={t("chat.composer.placeholder")}
            dir="auto"
            className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-5 outline-none placeholder:text-muted-foreground"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full text-muted-foreground"
            onClick={() => fileRef.current?.click()}
            aria-label={t("chat.composer.attach")}
          >
            <Paperclip className="size-5" />
          </Button>
        </div>
        {canSend ? (
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            aria-label={t("chat.composer.send")}
          >
            <SendHorizontal className="size-5 rtl:rotate-180" />
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-label={t("chat.composer.voiceSoon")} className="shrink-0">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  disabled
                  className="size-11 rounded-full"
                  aria-hidden
                  tabIndex={-1}
                >
                  <Mic className="size-5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("chat.composer.voiceSoon")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </form>
  );
}
