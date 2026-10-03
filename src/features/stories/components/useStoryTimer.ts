import { useEffect, useRef, useState } from "react";

const TICK_MS = 50;

/** Progress in [0, 1] for the current story; calls onDone at the end. Pausable. */
export function useStoryTimer(
  key: string,
  durationMs: number,
  paused: boolean,
  onDone: () => void,
) {
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [key]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      elapsed.current += TICK_MS;
      const next = Math.min(1, elapsed.current / durationMs);
      setProgress(next);
      if (next >= 1) {
        window.clearInterval(timer);
        done.current();
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [key, durationMs, paused]);

  return progress;
}
