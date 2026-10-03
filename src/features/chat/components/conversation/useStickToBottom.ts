import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { Message } from "@/types/message";

const NEAR_BOTTOM_PX = 120;

/**
 * Chat scrolling (PLAN.md §13.5):
 * - starts at the bottom, follows new messages only when already near the bottom;
 * - keeps the viewport still when older messages are prepended;
 * - counts unseen new messages for the "scroll to bottom" button.
 */
export function useStickToBottom(
  scrollRef: RefObject<HTMLDivElement | null>,
  messages: readonly Message[],
  viewerId: string,
) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const atBottomRef = useRef(true);
  const previous = useRef<{ first: string | undefined; last: string | undefined; height: number }>({
    first: undefined,
    last: undefined,
    height: 0,
  });

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const element = scrollRef.current;
      if (!element) return;
      element.scrollTo({ top: element.scrollHeight, behavior });
      atBottomRef.current = true;
      setIsAtBottom(true);
      setUnseen(0);
    },
    [scrollRef],
  );

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    atBottomRef.current = near;
    setIsAtBottom(near);
    if (near) setUnseen(0);
  }, [scrollRef]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || messages.length === 0) return;
    const first = messages[0]?.clientId ?? messages[0]?.id;
    const lastMessage = messages[messages.length - 1];
    const last = lastMessage?.clientId ?? lastMessage?.id;
    const before = previous.current;

    if (before.first === undefined) {
      element.scrollTop = element.scrollHeight;
    } else if (first !== before.first && last === before.last) {
      // Older page prepended: keep the same messages under the user's eyes.
      element.scrollTop += element.scrollHeight - before.height;
    } else if (last !== before.last) {
      const mine = lastMessage?.senderId === viewerId;
      if (atBottomRef.current || mine) element.scrollTop = element.scrollHeight;
      else setUnseen((count) => count + 1);
    } else if (atBottomRef.current) {
      // Same messages, new heights (translation arrived, image loaded).
      element.scrollTop = element.scrollHeight;
    }
    previous.current = { first, last, height: element.scrollHeight };
  }, [messages, scrollRef, viewerId]);

  return { isAtBottom, unseen, onScroll, scrollToBottom };
}
