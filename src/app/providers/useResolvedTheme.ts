import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";

export function useResolvedTheme(): "light" | "dark" {
  const theme = useDevicePreferencesStore((state) => state.theme);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}
