import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { RelativeTime } from "@/components/common/RelativeTime";
import { UserAvatar } from "@/components/common/UserAvatar";
import type { StoryTrayItem } from "@/types/story";

import { useMarkStoryViewed } from "../hooks/useStories";
import {
  nextPosition,
  previousPosition,
  startPosition,
  type StoryPosition,
} from "../lib/storyNavigation";
import { StoryOverlayText } from "./StoryOverlayText";
import { StoryProgress } from "./StoryProgress";
import { StoryReplyBar } from "./StoryReplyBar";
import { useStoryTimer } from "./useStoryTimer";

const IMAGE_DURATION_MS = 5_000;
const SWIPE_CLOSE_PX = 80;

interface StoryViewerProps {
  tray: StoryTrayItem[];
  userId: string;
  viewerId: string;
  onClose: () => void;
}

/** Fullscreen viewer: tap sides, hold to pause, swipe down or Esc to close. */
export function StoryViewer({ tray, userId, viewerId, onClose }: StoryViewerProps) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<StoryPosition | null>(() => startPosition(tray, userId));
  const [held, setHeld] = useState(false);
  const [typing, setTyping] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const markViewed = useMarkStoryViewed();
  const { mutate: markViewedMutate } = markViewed;

  const item = position ? tray[position.userIndex] : undefined;
  const story = position && item ? item.stories[position.storyIndex] : undefined;

  const goNext = useCallback(() => {
    setPosition((current) => {
      const next = current ? nextPosition(tray, current) : null;
      if (!next) onClose();
      return next ?? current;
    });
  }, [tray, onClose]);

  const goPrevious = useCallback(() => {
    setPosition((current) => (current ? (previousPosition(tray, current) ?? current) : current));
  }, [tray]);

  const duration =
    story?.media.kind === "video" && story.media.durationMs
      ? story.media.durationMs
      : IMAGE_DURATION_MS;
  const paused = held || typing || manualPause;
  const progress = useStoryTimer(story?.id ?? "none", duration, paused, goNext);

  useEffect(() => {
    if (story && !story.viewedByMe) markViewedMutate(story.id);
  }, [story, markViewedMutate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing) return;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") goNext();
      else if (event.key === "ArrowLeft") goPrevious();
      else if (event.key === " ") {
        event.preventDefault();
        setManualPause((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrevious, onClose, typing]);

  useEffect(() => {
    if (!item) onClose();
  }, [item, onClose]);

  if (!item || !story || !position) return null;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY, at: Date.now() };
    setHeld(true);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    setHeld(false);
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    if (event.clientY - start.y > SWIPE_CLOSE_PX) return onClose();
    // A short tap navigates; a long press only paused.
    if (Date.now() - start.at > 250) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const leftSide = event.clientX - rect.left < rect.width / 3;
    const isRtl = document.documentElement.dir === "rtl";
    if (leftSide !== isRtl) goPrevious();
    else goNext();
  }

  const own = item.user.id === viewerId;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("stories.viewer", { name: item.user.displayName })}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      <div className="relative flex h-full w-full max-w-[min(100vw,calc(100dvh*9/16))] flex-col overflow-hidden md:h-[min(100dvh,860px)] md:rounded-2xl">
        {story.media.kind === "video" ? (
          <video
            key={story.id}
            src={story.media.url}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            key={story.id}
            src={story.media.url}
            alt={story.media.alt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent"
          aria-hidden
        />

        <header className="relative z-10 space-y-3 px-3 pt-safe">
          <div className="pt-2">
            <StoryProgress
              count={item.stories.length}
              index={position.storyIndex}
              progress={progress}
            />
          </div>
          <div className="flex items-center gap-2 text-white">
            <UserAvatar user={item.user} size="sm" />
            <span className="min-w-0 truncate text-sm font-semibold">{item.user.displayName}</span>
            <RelativeTime iso={story.createdAt} className="text-xs text-white/70" />
            <button
              type="button"
              onClick={() => setManualPause((value) => !value)}
              aria-label={manualPause ? t("stories.play") : t("stories.pause")}
              className="ms-auto grid size-9 place-items-center rounded-full hover:bg-white/10"
            >
              {manualPause ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label={t("stories.close")}
              className="grid size-9 place-items-center rounded-full hover:bg-white/10"
            >
              <X className="size-6" />
            </button>
          </div>
        </header>

        <div
          className="relative z-0 flex flex-1 touch-none select-none items-center"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
        >
          <div className="w-full">
            <StoryOverlayText story={story} />
          </div>
        </div>

        <button
          type="button"
          onClick={goPrevious}
          aria-label={t("stories.previous")}
          className="absolute start-2 top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white md:grid"
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={t("stories.next")}
          className="absolute end-2 top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white md:grid"
        >
          <ChevronRight className="size-5 rtl:rotate-180" />
        </button>

        {!own && (
          <footer className="relative z-10 px-3 pb-4 pb-safe">
            <StoryReplyBar story={story} onFocusChange={setTyping} />
          </footer>
        )}
      </div>
    </div>
  );
}
