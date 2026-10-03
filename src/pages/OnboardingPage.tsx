import { Navigate, useNavigate, useParams } from "react-router";

import { ONBOARDING_STEPS, isOnboardingStep, paths, type OnboardingStep } from "@/app/router/paths";
import { ErrorState } from "@/components/common/ErrorState";
import { AppSplash } from "@/features/auth/components/AppSplash";
import { useMe } from "@/features/auth/hooks/useMe";
import { DiscoverStep } from "@/features/onboarding/components/steps/DiscoverStep";
import { NativeLanguageStep } from "@/features/onboarding/components/steps/NativeLanguageStep";
import { ProfileStep } from "@/features/onboarding/components/steps/ProfileStep";
import { ReceiveLanguageStep } from "@/features/onboarding/components/steps/ReceiveLanguageStep";
import { WelcomeStep } from "@/features/onboarding/components/steps/WelcomeStep";
import { firstIncompleteStep } from "@/features/onboarding/lib/firstIncompleteStep";
import { useOnboardingDraftStore } from "@/features/onboarding/stores/onboardingDraftStore";

export default function OnboardingPage() {
  const { step } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const nativeLanguage = useOnboardingDraftStore((state) => state.nativeLanguage);
  const receivingLanguage = useOnboardingDraftStore((state) => state.receivingLanguage);
  const resetDraft = useOnboardingDraftStore((state) => state.reset);

  if (me.isPending) return <AppSplash />;
  if (me.isError) return <ErrorState onRetry={() => void me.refetch()} className="h-app" />;
  if (!isOnboardingStep(step)) return <Navigate to={paths.onboarding()} replace />;

  const user = me.data;
  if (user.onboardingCompletedAt && step !== "discover") {
    // Just finished the profile step: continue to suggestions; otherwise leave onboarding.
    const target = step === "profile" ? paths.onboarding("discover") : paths.home();
    return <Navigate to={target} replace />;
  }

  // Steps can't be skipped: never go beyond the first incomplete one.
  const allowed = firstIncompleteStep(user, { nativeLanguage, receivingLanguage });
  const index = ONBOARDING_STEPS.indexOf(step);
  if (index > ONBOARDING_STEPS.indexOf(allowed))
    return <Navigate to={paths.onboarding(allowed)} replace />;

  const go = (target: OnboardingStep) => navigate(paths.onboarding(target));
  const next = () => {
    const following = ONBOARDING_STEPS[index + 1];
    if (following) go(following);
  };
  const previous = ONBOARDING_STEPS[index - 1];
  const position = {
    current: index + 1,
    total: ONBOARDING_STEPS.length,
    onBack: previous && step !== "discover" ? () => go(previous) : undefined,
  };

  switch (step) {
    case "welcome":
      return <WelcomeStep me={user} position={position} onNext={next} />;
    case "native-language":
      return <NativeLanguageStep position={position} onNext={next} />;
    case "receive-language":
      return <ReceiveLanguageStep position={position} onNext={next} />;
    case "profile":
      return <ProfileStep me={user} position={position} onNext={next} />;
    case "discover":
      return (
        <DiscoverStep
          position={position}
          onNext={() => {
            resetDraft();
            navigate(paths.chats(), { replace: true });
          }}
        />
      );
  }
}
