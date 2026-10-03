import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ThemePreference } from "@/types/preferences";

/** Device-local preferences (not tied to the account). PLAN.md §11. */
interface DevicePreferencesState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

/** Keep in sync with the inline theme script in index.html. */
export const DEVICE_PREFERENCES_KEY = "tenno.device-preferences";

export const useDevicePreferencesStore = create<DevicePreferencesState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: DEVICE_PREFERENCES_KEY, version: 1 },
  ),
);
