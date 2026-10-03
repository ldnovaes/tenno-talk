import { useEffect, type ReactNode } from "react";

import { useResolvedTheme } from "./useResolvedTheme";

const THEME_COLORS = { light: "#FFFFFF", dark: "#17212B" } as const;

/** Applies the .dark class and the browser theme-color. PLAN.md §18. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const resolved = useResolvedTheme();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[resolved]);
  }, [resolved]);

  return children;
}
