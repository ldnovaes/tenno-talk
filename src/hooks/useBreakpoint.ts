import { useMediaQuery } from "./useMediaQuery";

/** Keep in sync with the breakpoints in styles.css (PLAN.md §6.1). */
export const BREAKPOINTS = { md: 768, lg: 1024, xl: 1440 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

/** True when the viewport is at least the given breakpoint. */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

/** Structural switch between the mobile shell and the multi-pane shell. */
export function useIsMobile(): boolean {
  return !useBreakpoint("md");
}
