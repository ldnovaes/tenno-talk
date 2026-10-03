import type { OnboardingStep } from "@/app/router/paths";
import { env } from "@/lib/env";
import type { CurrentUser } from "@/types/user";

export interface OnboardingDraftProgress {
  nativeLanguage: string | null;
  receivingLanguage: string | null;
}

/** The furthest step the user may open, given what is already done. */
export function firstIncompleteStep(
  me: Pick<CurrentUser, "termsAcceptedVersion" | "onboardingCompletedAt">,
  draft: OnboardingDraftProgress,
): OnboardingStep {
  if (me.onboardingCompletedAt) return "discover";
  if (me.termsAcceptedVersion !== env.termsVersion) return "welcome";
  if (!draft.nativeLanguage) return "native-language";
  if (!draft.receivingLanguage) return "receive-language";
  return "profile";
}
