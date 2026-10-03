import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { registerClientStateClearer } from "@/features/auth/lib/clearClientState";
import type { CountryCode, LanguageCode } from "@/types/language";

/** Onboarding answers kept until the final submit; survives a reload (sessionStorage). */
export interface OnboardingDraft {
  nativeLanguage: LanguageCode | null;
  receivingLanguage: LanguageCode | null;
  displayName: string;
  username: string;
  bio: string;
  country: CountryCode;
  avatarUrl: string | null;
}

interface OnboardingDraftState extends OnboardingDraft {
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

const EMPTY: OnboardingDraft = {
  nativeLanguage: null,
  receivingLanguage: null,
  displayName: "",
  username: "",
  bio: "",
  country: "",
  avatarUrl: null,
};

export const useOnboardingDraftStore = create<OnboardingDraftState>()(
  persist(
    (set) => ({
      ...EMPTY,
      update: (patch) => set(patch),
      reset: () => set(EMPTY),
    }),
    { name: "tenno.onboarding-draft", storage: createJSONStorage(() => sessionStorage) },
  ),
);

registerClientStateClearer(() => useOnboardingDraftStore.getState().reset());
