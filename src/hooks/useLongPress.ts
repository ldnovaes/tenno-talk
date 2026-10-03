import { useCallback, useRef, type PointerEvent } from "react";

const MOVE_TOLERANCE = 10;

/** Touch long-press (mobile message actions). Ignores mouse input. */
export function useLongPress(onLongPress: () => void, delayMs = 450) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        navigator.vibrate?.(10);
        onLongPress();
      }, delayMs);
    },
    [onLongPress, delayMs],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!origin.current) return;
      const dx = Math.abs(event.clientX - origin.current.x);
      const dy = Math.abs(event.clientY - origin.current.y);
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) cancel();
    },
    [cancel],
  );

  return { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel };
}
