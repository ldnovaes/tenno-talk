import { create } from "zustand";

import { registerClientStateClearer } from "@/features/auth/lib/clearClientState";

import type { DisplayOverride } from "../lib/resolveMessageDisplay";

/**
 * Per-message "Show original / Show translation" choices. Kept outside the
 * component so it survives unmounts (virtualized lists). Not persisted.
 */
interface TranslationViewState {
  overrides: Record<string, DisplayOverride>;
  setOverride: (id: string, override: DisplayOverride | null) => void;
  reset: () => void;
}

export const useTranslationViewStore = create<TranslationViewState>()((set) => ({
  overrides: {},
  setOverride: (id, override) =>
    set((state) => {
      const next = { ...state.overrides };
      if (override) next[id] = override;
      else delete next[id];
      return { overrides: next };
    }),
  reset: () => set({ overrides: {} }),
}));

registerClientStateClearer(() => useTranslationViewStore.getState().reset());
